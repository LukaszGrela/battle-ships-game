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
import { emitRoomStateToPlayers } from "../utils/emitRoomStateToPlayers";
import ActiveGameRegistry from "../services/active-game-registry";

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
    const activeGameRegistry = ActiveGameRegistry.getInstance();
    const roomService = RoomService.getInstance();
    const existing = sessions.readSession(clientId);
    if (existing) {
      existing.socketId = socket.id;

      // check if session has a game id
      if (existing.gameId) {
        // find room
        if (
          !roomService.getRoom(existing.gameId) &&
          !activeGameRegistry.hasRoom(existing.gameId)
        ) {
          // if not found remove id
          existing.gameId = undefined;
        }
      }

      existing.socketId = socket.id;
      existing.disconnectedAt = undefined;

      // store changes
      sessions.updateSession(clientId, existing);
      socket.emit("session_restored", existing);
      if (existing.gameId) {
        const room = roomService.getRoom(existing.gameId);
        const warRoom = activeGameRegistry.getRoom(existing.gameId);
        if (warRoom && warRoom.activatePlayer(clientId)) {
          socket.emit("welcome", clientId);
          // emitRoomStateToPlayers(io, room);
        }
        if (room) {
          // activate user
          room.players[clientId]!.active = true;
          roomService.saveRoom(room);

          socket.emit("welcome", clientId);
          emitRoomStateToPlayers(io, room);
        }
      }
    } else {
      socket.emit(
        "session_created",
        sessions.createSession(clientId, socket.id),
      );
    }

    ActiveUsersServiceSingleton.getInstance().setUser(socket.id);

    const activeOpenGames = activeGameRegistry.getOpenGames();
    const openGames = roomService.getOpenGames();
    console.log("open_games", activeOpenGames);

    // in the lobby - send open games
    io.emit("open_games", openGames);

    if (
      existing &&
      existing.gameId &&
      roomService.getRoom(existing.gameId) &&
      activeGameRegistry.hasRoom(existing.gameId)
    ) {
      const gameState = activeGameRegistry
        .getRoom(existing.gameId)
        ?.getGameState(clientId);
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
      ClientSessionServiceSingleton.getInstance().listSessions(),
      ClientSessionServiceSingleton.getInstance()
        .listSessions()
        .filter(({ disconnectedAt }) => !disconnectedAt).length,
    );

    emitStats(io);
  };
