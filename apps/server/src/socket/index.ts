import { DisconnectReason, Server, Socket } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import RoomService from "../services/room.service";
import { singleUser } from "../utils/singleUser";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { toGameState } from "../utils/toGameState";
import { setWaiting } from "../utils/setWaiting";
import { getOtherPlayer } from "../utils/getOtherPlayer";
import { warRoomNames } from "../utils/WarRoomNameService";

export const registerSocketHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  const roomService = RoomService.getInstance();

  const rooms = roomService.listRooms();
  console.log("[registerSocketHandlers]", "User connected", socket.id);
  console.log(
    "Rooms",
    rooms.length,
    Array.from(rooms.values()).map((n) => n.phase),
  );

  const openGames = roomService.getOpenGames();
  console.log("[registerSocketHandlers]", "openGames", openGames.length);

  // in the lobby - send open games
  io.emit("open_games", openGames);

  // send null game_updated for stale state
  socket.emit("game_updated", null);

  socket.on("error", console.error);

  socket.on("get_rooms", function getWarRooms(callback) {
    callback?.(roomService.listRooms());
  });

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

  // user has disonnected
  socket.on("disconnect", (reason: DisconnectReason) => {
    // Logic: If player leaves, broadcast game_over or handle session
    console.log("Player disconnected", socket.id, "due to", reason);
    const room = roomService.findRoomBySocketId(socket.id);
    if (room) {
      if (room.phase === "playing") {
        // player abandoned game, finish it
        room.phase = "finished";
        // leave room
        if (room.players[socket.id]) {
          room.players[socket.id]!.active = false;
        }
      } else if (room.phase === "placement") {
        // if last user left kill the room
        if (singleUser(room)) {
          console.log(
            "[on disconnect] placement, single user, delete",
            room.id,
          );

          roomService.deleteRoom(room.id);
          io.emit("open_games", roomService.getOpenGames());
          return;
        } else {
          // // reset to a waiting state
          // room.phase = EGamePhase.Waiting as never;

          // io.emit("open_games", RoomService.getOpenGames());
          setWaiting(io, socket);
          const other = getOtherPlayer(socket.id, room.players);
          console.log(
            "[index][on disconnect]",
            other && roomService.findRoomBySocketId(other?.id)?.phase,
            other && roomService.getRoom(room?.id)?.phase,
          );
        }
      } else if (room.phase === "waiting") {
        // there should only be one user anyway
        console.log("[on disconnect] waiting, delete", room.id);
        roomService.deleteRoom(room.id);
        io.emit("open_games", roomService.getOpenGames());
        return;
      }
      const players = roomService.getRoom(room.id)!.players;
      // notify other party
      // per player emit
      Object.keys(players).forEach((playerId) => {
        io.to(playerId).emit(
          "game_updated",
          toGameState(playerId, roomService.getRoom(room.id)!),
        );
      });
    }
  });
};
