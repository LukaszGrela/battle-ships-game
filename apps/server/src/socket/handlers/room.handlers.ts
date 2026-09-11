import { Server, Socket } from "socket.io";
import { RoomService } from "../../services/room.service";
import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomIdentity,
} from "@repo/types";
import { getOtherPlayer } from "../../utils/getOtherPlayer";
import { toGameState } from "../../utils/toGameState";
import { warRoomNames } from "../../utils/WarRoomNameService";
import { getShips } from "../../utils/getShips";
import { getShortPirateName } from "../../utils/getPirateyName";
import { createEmptyBoard } from "@repo/game-logic";
import { createNewRoom } from "../../utils/createNewRoom";
import { nanoid } from "nanoid";

export const registerRoomHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  socket.on("join_game", (identifier) => {
    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof identifier === "string"
        ? { name: identifier, id: nanoid() }
        : identifier;

    // At this point roomId should be assured to be unique
    // if roomId is invalid here maybe someone is tampering the API, reject
    let room = RoomService.getRoom(roomId.id);

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

      RoomService.saveRoom(room);

      // Game started - send open games
      io.emit("open_games", RoomService.getOpenGames());
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
      io.emit("open_games", RoomService.getOpenGames());
    } else {
      // no more space in the room
      socket.emit("error", "Room full");

      // Someone wanted to join - send open games
      io.emit("open_games", RoomService.getOpenGames());
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
    const room = RoomService.findRoomBySocketId(socket.id);
    // console.log("leave_game", room);
    if (room) {
      if (room.phase === "waiting") {
        // 1 player, game is abandoned
        socket.emit("game_updated", null);
        // remove room entry
        RoomService.deleteRoom(room.id);
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
    io.emit("open_games", RoomService.getOpenGames());
  });
};
