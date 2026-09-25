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
import { warRoomNames } from "../services/WarRoomName.service";
import { emitStats } from "../utils/emitStats";
import ActiveUsersServiceSingleton from "../services/users.service";
import ClientSessionServiceSingleton from "../services/client-session.service";

export const registerSocketHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const clientId = socket.handshake.auth.clientId;

  if (!clientId || typeof clientId !== "string") {
    // invalid connection
    socket.disconnect();
    return;
  }
  const sessions = ClientSessionServiceSingleton.getInstance();

  const existing = sessions.readSession(clientId);
  if (existing) {
    existing.socketId = socket.id; // podmieniamy na nowy socket
    sessions.updateSession(clientId, existing);
    socket.emit("session_restored", existing);
  } else {
    sessions.createSession(clientId, socket.id);

    socket.emit("session_created");
  }

  ActiveUsersServiceSingleton.getInstance().setUser(socket.id);

  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);

  const roomService = RoomService.getInstance();

  const rooms = roomService.listRooms();

  const openGames = roomService.getOpenGames();

  // in the lobby - send open games
  io.emit("open_games", openGames);

  // send null game_updated for stale state
  socket.emit("game_updated", null);

  socket.on("error", (error) =>
    console.error("[registerSocketHandlers.onError]", error),
  );

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

  console.log(
    "[STATS] active users",
    ActiveUsersServiceSingleton.getInstance().countUsers(),
  );

  emitStats(io);

  // user has disonnected
  socket.on("disconnect", (reason: DisconnectReason) => {
    // Logic: If player leaves, broadcast game_over or handle session
    console.log("Player disconnected", socket.id, "due to", reason);

    ActiveUsersServiceSingleton.getInstance().removeUser(socket.id);
    const clientSession = sessions.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      emitStats(io);
      return;
    }

    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      if (room.phase === "playing") {
        // player abandoned game, finish it
        room.phase = "finished";
        // leave room
        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
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
          //
          setWaiting(io, socket);
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
        const playerSession = sessions.readSession(playerId);
        if (playerSession) {
          io.to(playerSession.socketId).emit(
            "game_updated",
            toGameState(playerId, roomService.getRoom(room.id)!),
          );
        }
      });
    }
    emitStats(io);
  });
};
