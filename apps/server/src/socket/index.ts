import { Server, Socket } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { emitStats } from "../utils/emitStats";
import ActiveUsersServiceSingleton from "../services/users.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { registerServerHandlers } from "./handlers/server.handlers";
import { emitRoomStateToPlayers } from "../utils/emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { getSession } from "../security/auth";

export const factoryConnectHandler =
  (io: Server<IClientToServerEvents, IServerToClientEvents>) =>
  (socket: Socket<IClientToServerEvents, IServerToClientEvents>) => {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const sessionPayload = getSession(socket);
    const clientId = sessionPayload.playerId;
    console.log("[factoryConnectHandler]", clientId, sessions);

    // register listener
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerServerHandlers(io, socket);

    // emit events
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const existing = sessions.readSession(clientId);
    if (existing) {
      existing.socketId = socket.id;

      // check if session has a game id
      if (existing.gameId) {
        // find room
        if (!activeGameRegistry.hasRoom(existing.gameId)) {
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
        const warRoom = activeGameRegistry.getRoom(existing.gameId);
        if (warRoom && warRoom.activatePlayer(clientId)) {
          socket.emit("welcome", clientId);
          emitRoomStateToPlayers(io, clientId, existing.gameId);
        }
      }
    } else {
      socket.emit(
        "session_created",
        sessions.createSession(clientId, sessionPayload.seed, socket.id),
      );
    }

    ActiveUsersServiceSingleton.getInstance().setUser(socket.id);

    const activeOpenGames = activeGameRegistry.getOpenGames();

    console.log("[factoryConnectHandler]", "open_games", activeOpenGames);
    // in the lobby - send open games
    io.emit("open_games", activeOpenGames);

    if (
      existing &&
      existing.gameId &&
      activeGameRegistry.hasRoom(existing.gameId)
    ) {
      const gameState =
        activeGameRegistry.getRoom(existing.gameId)?.getGameState(clientId) ??
        null;
      // send notification with game update, so the user reconnects to the game
      socket.emit("game_updated", gameState);
    } else {
      // send null game_updated for stale state
      socket.emit("game_updated", null);
    }

    console.log(
      "[factoryConnectHandler]",
      "[STATS] active users",
      "Count users",
      ActiveUsersServiceSingleton.getInstance().countUsers(),
      "Sessions",
      ClientSessionServiceSingleton.getInstance().listSessions(),
      "Active Sessions",
      ClientSessionServiceSingleton.getInstance()
        .listSessions()
        .filter(({ disconnectedAt }) => !disconnectedAt).length,
    );

    emitStats(io);
  };
