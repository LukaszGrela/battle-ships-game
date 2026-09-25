import {
  ECellStatus,
  IClientToServerEvents,
  IHistoryEntry,
  IServerToClientEvents,
  TShip,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import RoomService from "../../services/room.service";
import {
  getCell,
  isSunk,
  isValidPlacement,
  placeShip,
  resolveAttack,
  setCell,
} from "@repo/game-logic";
import { toGameState } from "../../utils/toGameState";
import { getOtherPlayer } from "../../utils/getOtherPlayer";
import { setWaiting } from "../../utils/setWaiting";
import { warRoomNames } from "../../services/WarRoomName.service";
import { emitStats } from "../../utils/emitStats";
import ClientSessionServiceSingleton from "../../services/client-session.service";

function dataTampered(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) {
  const session = ClientSessionServiceSingleton.getInstance();

  const clientId = socket.handshake.auth.clientId;
  const clientSession = session.readSession(clientId);

  console.group("[dataTampered]");
  console.error("clientId", clientId);
  console.error("clientSession", clientSession);
  console.groupEnd();

  socket.emit("error", "Internal server error");
  // kick out (ab)user
  socket.emit("game_updated", null);

  session.deleteSession(clientId);

  // change game state
  setWaiting(io, socket);
}

export const registerGameHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const session = ClientSessionServiceSingleton.getInstance();
  const clientId = socket.handshake.auth.clientId;

  socket.on("place_ships", (ships) => {
    const roomService = RoomService.getInstance();
    // console.log("Place ships");
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);

      return;
    }
    // room data
    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      // console.log("Room", room.name, room.phase);
      if (room.phase !== "placement") {
        console.error("Wrong phase", room.phase, room);
        socket.emit("error", "Can't place ships now");
        return;
      }
      // Update board and ships list
      const board = room.boards[clientId];
      const expectedShips = room.ships[clientId];
      if (!board || !expectedShips) {
        console.error("No board or ships");
        dataTampered(io, socket);
      } else {
        if (expectedShips.length !== ships.length) {
          console.error(
            "Data tampered, expected ships length != incoming ships length",
          );
          dataTampered(io, socket);
          //
          return;
        }

        const placedShips = ships
          .map((ship) => {
            if (ship.coords && ship.orientation) {
              if (
                !isValidPlacement(board, ship.coords, ship, ship.orientation)
              ) {
                return null;
              }
              placeShip(board, ship.coords, ship, ship.orientation);
              const { type, ...parts } = ship;
              return {
                type: "placed",
                coords: ship.coords,
                hits: [],
                id: ship.id,
                orientation: ship.orientation,
                size: ship.size,
              } as TShip;
            }
          })
          .filter(Boolean) as TShip[];

        if (placedShips.length !== expectedShips.length) {
          console.error("Some ships are not placed.");

          dataTampered(io, socket);
          return;
        } else {
          const self = room.players[clientId]!;
          room.ships[clientId] = placedShips;
          self.ready = true;
          // is other player ready?
          const opponentId = getOtherPlayer(clientId, room.players)?.id;

          // console.log("Opponent id", opponentId);

          // console.log("Players", room.players);

          if (opponentId) {
            if (room.players[opponentId]!.ready) {
              // console.log("Opponnent ready, switch to playing.");
              // we can start the game
              room.phase = "playing";
              room.game_started = new Date().toISOString();
            } else {
              // console.log("Opponnent not ready, notify him.");
              // notify other user
              const opponentSession = session.readSession(opponentId);
              if (opponentSession) {
                io.to(opponentSession.socketId).emit("player_ready", {
                  name: self.name,
                  seed: self.seed,
                  owner: self.owner,
                  ready: self.ready,
                });
              }
            }
          }
        }
        // store changes
        roomService.saveRoom(room);
        // console.log("room.phase", room.phase);
        if (room.phase === "placement") {
          socket.emit("game_updated", toGameState(clientId, room));
        } else {
          // switched to playing, notify all parties
          Object.keys(room.players).forEach((playerId) => {
            const playerSession = session.readSession(playerId);
            if (playerSession) {
              io.to(playerSession.socketId).emit(
                "game_updated",
                toGameState(playerId, room),
              );
            }
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
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);

      return;
    }
    const roomService = RoomService.getInstance();
    const room = roomService.getRoom(clientSession.gameId);

    // 1. Validation logic
    if (!room || room.turn !== clientId || room.phase !== "playing") {
      console.error("Not your turn", room?.turn, room?.phase, room);
      socket.emit("error", "Not your turn or game not active");
      return;
    }

    // Race condition prevention: Atomic check
    const opponentId = getOtherPlayer(clientId, room.players)?.id;

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

    if (
      cell === ECellStatus.Hit ||
      cell === ECellStatus.Destroyed ||
      cell === ECellStatus.Miss
    )
      return; // Prevent attacking same spot

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
      turn: clientId,
    };

    if (room.history.length === 0) {
      historyEntry.init = true;
    }

    // opponent ships
    const enemyFleet = room.ships[opponentId];
    // console.log("enemyFleet", cell, enemyFleet);
    if (enemyFleet && typeof cell === "number" && cell >= 0) {
      // find ship
      const index = enemyFleet.findIndex(({ id }) => id === cell);
      // console.log("index", index);

      if (index >= 0) {
        const enemyShip = enemyFleet[index];
        // console.log("enemyShip", enemyShip);

        if (enemyShip && enemyShip?.type === "placed" && !isSunk(enemyShip)) {
          enemyShip.hits.push(coord);
          if (enemyShip.hits.length === enemyShip.size) {
            // vessel sunk
            historyEntry.isSunk = true;
          }
        }
      }
    }
    // check end game condition
    const enemyHasShips = enemyFleet?.some((ship) => !isSunk(ship));
    // console.log("enemyHasShips", enemyHasShips);
    if (!enemyHasShips) {
      // enemy fleet defeated
      historyEntry.finish = true;
      historyEntry.whoWon = clientId;
      room.phase = "finished";
      room.result = {
        [clientId]: "win",
        [opponentId]: "lost",
      };
      room.game_finished = new Date().toISOString();
      //
      warRoomNames.releaseRoom(room.name);
      //
      emitStats(io);
    } else {
      // 3. switch turn
      room.turn = opponentId; // Pass turn
    }

    // record move
    room.history.push(historyEntry);

    // store room changes
    roomService.saveRoom(room);

    // 4. broadcast update
    const freshRoom = roomService.getRoom(room.id)!;
    const players = freshRoom.players;

    // per player emit
    Object.keys(players).forEach((playerId) => {
      const playerSession = session.readSession(playerId);
      if (playerSession) {
        io.to(playerSession.socketId).emit(
          "game_updated",
          toGameState(playerId, freshRoom),
        );
      }
    });
  });
};
