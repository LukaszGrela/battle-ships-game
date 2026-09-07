import { Server } from "socket.io";
import {
  TGameState,
  IClientToServerEvents,
  IServerToClientEvents,
  ECellStatus,
  EGamePhase,
  TCoordinate,
  TRoomState,
  TRoomIdentity,
  IPlayer,
  TShip,
  TBoard,
  IHistoryEntry,
} from "@repo/types";
import { findRoom } from "./utils/findRoom";
import {
  createEmptyBoard,
  getCell,
  placeShip,
  resolveAttack,
  setCell,
} from "@repo/game-logic";
import { WarRoomNameService } from "./utils/WarRoomNameService";
import { nanoid } from "nanoid";
import { getShortPirateName } from "./utils/getPirateyName";

const PORT = 3001;

const io = new Server<IClientToServerEvents, IServerToClientEvents>({
  cors: { origin: "*" },
});

type TRoomsMap = Map<string, TRoomState>;

const rooms: TRoomsMap = new Map<string, TRoomState>();
const warRoomNames = new WarRoomNameService();

console.log("Battleship Game Server, port", PORT);

io.on("connection", (socket) => {
  console.log("User connected", socket.id);
  console.log("Rooms", rooms.size, rooms);

  // in the lobby - send open games
  io.emit("open_games", getOpenGames(rooms));
  // send null game_updated for stale state
  socket.emit("game_updated", null);

  socket.on(
    "get_war_room_name",
    function getWarRoomNameHandler(proposition: string | null, callback) {
      if (proposition === null) {
        // generate name
        callback(warRoomNames.getAvailableName());
      } else {
        // test custom name
        if (warRoomNames.isFreeToClaim(proposition)) {
          callback(proposition);
        } else {
          // generate name
          callback(warRoomNames.getAvailableName());
        }
      }
    },
  );

  socket.on("error", console.error);

  socket.on("join_game", (identifier) => {
    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof identifier === "string"
        ? { name: identifier, id: nanoid() }
        : identifier;

    // At this point roomId should be assured to be unique
    // if roomId is invalid here maybe someone is tampering the API, reject
    let room = rooms.get(roomId.id);

    if (!room) {
      // Create new room
      room = createNewRoom(
        {
          ...roomId,
        },
        {
          id: socket.id,
          active: true,
          name: getShortPirateName(),
          ready: false,
        },
      );

      warRoomNames.claimRoom(roomId.name);

      rooms.set(roomId.id, room);

      // Game started - send open games
      io.emit("open_games", getOpenGames(rooms));
    } else if (Object.keys(room.players).length < 2) {
      // Other player joins the battle
      room.boards[socket.id] = createEmptyBoard();

      const anotherPlayer = {
        id: socket.id,
        active: true,
        name: getShortPirateName(),
        ready: false,
      };

      room.players[socket.id] = anotherPlayer;

      room.phase = "placement";

      room.ships = getShips(Object.keys(room.players), [5, 4, 3, 3, 2]);
      // room.game_started = new Date().toISOString();
      //
      io.emit("open_games", getOpenGames(rooms));
    } else {
      // no more space in the room
      socket.emit("error", "Room full");

      // Someone wanted to join - send open games
      io.emit("open_games", getOpenGames(rooms));
      return;
    }

    socket.join(roomId.id);
    socket.emit("welcome", socket.id);
    // per player emit
    Object.keys(room.players).forEach((playerId) => {
      io.to(playerId).emit("game_updated", toGameState(playerId, room));
    });
  });

  socket.on("leave_game", () => {
    const room = findRoom(rooms, socket.id);
    console.log("leave_game", rooms, room);
    if (room) {
      if (room.phase === "waiting") {
        // 1 player, game is abandoned
        socket.emit("game_updated", null);
        // remove room entry
        rooms.delete(room.id);
        warRoomNames.releaseRoom(room.name);
      } else if (room.phase === "placement") {
        // 2 players, one leaving, game play not started
        // turn to waiting phase
        room.phase = "waiting";
        const other = getOtherPlayer(socket.id, room.players)!;
        // if user that left is the "owner" change the turn
        room.turn = other.id;
        //
        delete room.boards[socket.id];
        delete room.players[socket.id];
        room.ships = {};

        socket.emit("game_updated", null);
        // notify other player
        io.to(other.id).emit("game_updated", toGameState(other.id, room));
      } else if (room.phase === "playing") {
        const other = getOtherPlayer(socket.id, room.players)!;
        // one player forfaits
        room.phase = "finished";
        room.result = {
          [socket.id]: "lost",
          [other.id]: "win",
        };
        room.game_finished = new Date().toISOString();

        // per player emit
        Object.keys(room.players).forEach((playerId) => {
          io.to(playerId).emit("game_updated", toGameState(playerId, room));
        });
      }
    } else {
      socket.emit("error", "No game to leave");
    }
    io.emit("open_games", getOpenGames(rooms));
  });

  socket.on("place_ships", (ships) => {
    console.log("Place ships");
    // room data
    const room = findRoom(rooms, socket.id);
    if (room) {
      console.log("Room", room.name, room.phase);
      if (room.phase !== "placement") {
        socket.emit("error", "Can't place ships now");
        return;
      }
      // Update board and ships list
      const board = room.boards[socket.id];
      const expectedShips = room.ships[socket.id];
      if (!board || !expectedShips) {
        console.error("No board or ships");
        socket.emit("error", "Internal server error");
        // room state corrupted
        socket.emit("game_updated", null);
      } else {
        if (expectedShips.length !== ships.length) {
          console.error(
            "Data tampered, expected ships length != incoming ships length",
          );
          socket.emit("error", "Internal server error");
          // incoming data tampered
          socket.emit("game_updated", null);
          return;
        }

        const placedShips = ships
          .map((ship) => {
            if (ship.coords && ship.orientation) {
              placeShip(board, ship.coords, ship, ship.orientation);
              const { type, ...parts } = ship;
              return {
                type: "placed",
                coords: ship.coords,
                hits: 0,
                id: ship.id,
                orientation: ship.orientation,
                size: ship.size,
              } as TShip;
            }
          })
          .filter(Boolean) as TShip[];

        if (placedShips.length !== expectedShips.length) {
          console.error("Some ships are not placed.");

          socket.emit("error", "Some ships are not placed.");
          socket.emit("game_updated", toGameState(socket.id, room));
          return;
        } else {
          const self = room.players[socket.id]!;
          room.ships[socket.id] = placedShips;
          self.ready = true;
          // is other player ready?
          const opponentId = getOtherPlayer(socket.id, room.players)?.id;

          console.log("Opponent id", opponentId);

          console.log("Players", room.players);

          if (opponentId) {
            if (room.players[opponentId]!.ready) {
              console.log("Opponnent ready, switch to playing.");
              // we can start the game
              room.phase = "playing";
            } else {
              console.log("Opponnent not ready, notify him.");
              // notify other user
              io.to(opponentId).emit("player_ready", self.name);
            }
          }
        }
        console.log("room.phase", room.phase);
        if (room.phase === "placement") {
          socket.emit("game_updated", toGameState(socket.id, room));
        } else {
          // switched to playing, notify all parties
          Object.keys(room.players).forEach((playerId) => {
            io.to(playerId).emit("game_updated", toGameState(playerId, room));
          });
        }
      }
    } else {
      console.error("no room, invalid state");
      socket.emit("error", "Internal server error");
      // no room, invalid state
      socket.emit("game_updated", null);
    }
  });

  socket.on("attack_coordinate", (coord) => {
    const room = findRoom(rooms, socket.id);

    // 1. Validation logic
    if (!room || room.turn !== socket.id || room.phase !== "playing") {
      socket.emit("error", "Not your turn or game not active");
      return;
    }

    // Race condition prevention: Atomic check
    const opponentId = getOtherPlayer(socket.id, room.players)?.id;

    if (!opponentId) return;

    // 2. Process move
    const targetBoard = room.boards[opponentId];
    if (!targetBoard) {
      console.error(
        "Failed to retrieve game board for opponent id",
        opponentId,
      );
      return;
    }
    const cell = getCell(targetBoard, coord.x, coord.y);
    if (typeof cell === "number" && cell < 0) {
      console.error(
        "Failed to retrieve board cell",
        `Error code: ${cell}`,
        coord,
        targetBoard,
      );
      return;
    }

    if (cell === ECellStatus.Hit || cell === ECellStatus.Miss) return; // Prevent attacking same spot
    // here coords are correct

    // Logic: Update board status
    const attackResult = resolveAttack(targetBoard, coord);
    const result = setCell(targetBoard, coord.x, coord.y, attackResult);

    if (result < 0) {
      console.error("Failed to update board cell", coord, targetBoard);
      return;
    }
    const historyEntry: IHistoryEntry = {
      coords: coord,
      isSunk: false,
      result: attackResult,
      turn: socket.id,
    };

    if (room.history.length === 0) {
      historyEntry.init = true;
    }

    // opponent ships
    const enemyFleet = room.ships[opponentId];
    console.log("enemyFleet", cell, enemyFleet);
    if (enemyFleet && typeof cell === "number" && cell >= 0) {
      // find ship
      const index = enemyFleet.findIndex(({ id }) => id === cell);
      console.log("index", index);

      if (index >= 0) {
        const enemyShip = enemyFleet[index];
        console.log("enemyShip", enemyShip);

        if (enemyShip && enemyShip?.type === "placed") {
          enemyShip.hits++;
          if (enemyShip.hits === enemyShip.size) {
            // vessel sunk
            historyEntry.isSunk = true;
          }
        }
      }
    }
    // check end game condition
    const shipIsSunk = (ship: TShip) => {
      return ship.type === "placed" && ship.hits === ship.size;
    };
    const enemyHasShips = enemyFleet?.some((ship) => !shipIsSunk(ship));
    console.log("enemyHasShips", enemyHasShips);
    if (!enemyHasShips) {
      // enemy fleet defeated
      historyEntry.finish = true;
      historyEntry.whoWon = socket.id;
      room.phase = "finished";
      room.result = {
        [socket.id]: "win",
        [opponentId]: "lost",
      };
      room.game_finished = new Date().toISOString();
    } else {
      // 3. switch turn
      room.turn = opponentId; // Pass turn
    }

    // record move
    room.history.push(historyEntry);

    // 4. broadcast update
    // per player emit
    Object.keys(room.players).forEach((playerId) => {
      io.to(playerId).emit("game_updated", toGameState(playerId, room));
    });
  });

  socket.on("disconnect", (reason) => {
    // Logic: If player leaves, broadcast game_over or handle session
    console.log("Player disconnected", socket.id, "due to", reason);
    const room = findRoom(rooms, socket.id);
    if (room) {
      if (room.phase === "playing") {
        // player abandoned game, finish it
        room.phase = "finished";
        // leave room
        if (room.players[socket.id]) {
          room.players[socket.id]!.active = false;
        }
      }
      if (room.phase === "placement") {
        // if last user left kill the room
        if (singleUser(room)) {
          rooms.delete(room.id);
          io.emit("open_games", getOpenGames(rooms));
          return;
        } else {
          // reset to a waiting state
          room.phase = EGamePhase.Waiting as never;

          io.emit("open_games", getOpenGames(rooms));
        }
      }
      // notify other party
      // per player emit
      Object.keys(room.players).forEach((playerId) => {
        io.to(playerId).emit("game_updated", toGameState(playerId, room));
      });
    }
  });
});

io.listen(PORT);

function getOpenGames(list: TRoomsMap): TRoomIdentity[] {
  return Array.from(list.entries())
    .filter(([_, { phase }]) => phase === EGamePhase.Waiting)
    .map(([_, { id, name, game_finished, game_started, game_created }]) => ({
      id,
      name,
      game_finished,
      game_started,
      game_created,
    }));
}

function singleUser(state: TRoomState): boolean {
  return (
    Object.values(state.players).filter(({ active }) => active).length === 1
  );
}

function toGameState(playerId: string, state: TRoomState): TGameState {
  console.log("toGameState", playerId, state);
  const player = getPlayerById(playerId, state.players)!;
  console.log("player", player);
  if (state.phase === EGamePhase.Waiting) {
    return {
      id: state.id,
      name: state.name,
      phase: EGamePhase.Waiting,
      game_created: state.game_created,
      game_finished: state.game_finished,
      game_started: state.game_started,
      result: state.result,
      turn: state.turn,
      self: player,
      myBoard: state.boards[player.id] ?? [],
    };
  } else {
    const enemy = getOtherPlayer(playerId, state.players)!;

    return {
      id: state.id,
      name: state.name,
      phase: state.phase,
      game_created: state.game_created,
      game_finished: state.game_finished,
      game_started: state.game_started,
      result: state.result,
      turn: state.turn,
      self: player,
      enemy,
      ships: state.ships[player.id] ?? [],
      myBoard: state.boards[player.id] ?? [],
      enemyBoard: (
        state.boards[enemy.id] ?? ([] as TBoard<ECellStatus | number>)
      ).map((row) => {
        return row.map((cell) => {
          // allow all but ECellStatus.Ship
          if (typeof cell === "number" || cell === ECellStatus.Ship) {
            return ECellStatus.Empty;
          }
          return cell;
        });
      }),
    };
  }
}

function getShips(
  playerIds: string[],
  shipSizes: number[],
): Record<string, TShip[]> {
  return playerIds.reduce(
    (acc, id) => {
      return {
        ...acc,
        [id]: shipSizes.map((size, index): TShip => ({
          id: index,
          type: "pending",
          size,
          placed: false,
        })),
      };
    },
    {} as Record<string, TShip[]>,
  );
}

function createNewRoom(
  identifier: Pick<TRoomIdentity, "id" | "name">,
  firstPlayer: IPlayer,
): TRoomState {
  return {
    ...identifier,
    boards: {
      [firstPlayer.id]: createEmptyBoard(),
    },
    game_created: new Date().toISOString(),
    game_started: null,
    game_finished: null,
    history: [],
    phase: EGamePhase.Waiting,
    players: {
      [firstPlayer.id]: firstPlayer,
    },
    result: {},
    ships: {},
    turn: firstPlayer.id,
  };
}

function getPlayerById(
  playerId: string,
  players: Record<string, IPlayer>,
): IPlayer | undefined {
  console.log("getPlayerById", playerId, players);
  return Object.values(players).find((value) => value.id == playerId);
}

function getOtherPlayer(
  playerId: string,
  players: Record<string, IPlayer>,
): IPlayer | undefined {
  return Object.values(players).find((value) => value.id != playerId);
}
