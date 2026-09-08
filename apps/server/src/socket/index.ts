import { DisconnectReason, Server, Socket } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import { RoomService } from "../services/room.service";
import { singleUser } from "../utils/singleUser";
import { EGamePhase } from "@repo/types";
import { toGameState } from "../utils/toGameState";

export const registerSocketHandlers = (io: Server, socket: Socket) => {
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);

  const rooms = RoomService.getRooms();
  console.log("User connected", socket.id);
  console.log("Rooms", rooms.size, rooms);

  // in the lobby - send open games
  io.emit("open_games", RoomService.getOpenGames());

  // send null game_updated for stale state
  socket.emit("game_updated", null);

  socket.on("error", console.error);

  // user has disonnected
  socket.on("disconnect", (reason: DisconnectReason) => {
    // Logic: If player leaves, broadcast game_over or handle session
    console.log("Player disconnected", socket.id, "due to", reason);
    const room = RoomService.findRoomBySocketId(socket.id);
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
          RoomService.deleteRoom(room.id);
          io.emit("open_games", RoomService.getOpenGames());
          return;
        } else {
          // reset to a waiting state
          room.phase = EGamePhase.Waiting as never;

          io.emit("open_games", RoomService.getOpenGames());
        }
      }
      // notify other party
      // per player emit
      Object.keys(room.players).forEach((playerId) => {
        io.to(playerId).emit("game_updated", toGameState(playerId, room));
      });
    }
  });
};
