import { Server, Socket } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import RoomService from "../services/room.service";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { toGameState } from "../utils/toGameState";
import { emitStats } from "../utils/emitStats";
import ActiveUsersServiceSingleton from "../services/users.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { registerServerHandlers } from "./handlers/server.handlers";

export const factoryConnectHandler =
  (io: Server<IClientToServerEvents, IServerToClientEvents>) =>
  (socket: Socket<IClientToServerEvents, IServerToClientEvents>) => {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;

    console.log("[factoryConnectHandler]", clientId, sessions);

    // check valid connection
    if (!clientId || typeof clientId !== "string") {
      socket.disconnect(true);
      return;
    }

    // register listener
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerServerHandlers(io, socket);

    // emit events
    const roomService = RoomService.getInstance();
    const existing = sessions.readSession(clientId);
    if (existing) {
      existing.socketId = socket.id;

      // check if session has a game id
      if (existing.gameId) {
        // find room
        if (!roomService.getRoom(existing.gameId)) {
          // if not found remove id
          existing.gameId = undefined;
        }
      }

      // store changes
      sessions.updateSession(clientId, existing);
      socket.emit("session_restored", existing);
    } else {
      socket.emit(
        "session_created",
        sessions.createSession(clientId, socket.id),
      );
    }

    ActiveUsersServiceSingleton.getInstance().setUser(socket.id);

    const openGames = roomService.getOpenGames();

    // in the lobby - send open games
    io.emit("open_games", openGames);

    if (existing && existing.gameId && roomService.getRoom(existing.gameId)) {
      // send notification with game update, so the user reconnects to the game
      socket.emit(
        "game_updated",
        toGameState(clientId, roomService.getRoom(existing.gameId)!),
      );
    } else {
      // send null game_updated for stale state
      socket.emit("game_updated", null);
    }

    console.log(
      "[STATS] active users",
      ActiveUsersServiceSingleton.getInstance().countUsers(),
    );

    emitStats(io);
  };
