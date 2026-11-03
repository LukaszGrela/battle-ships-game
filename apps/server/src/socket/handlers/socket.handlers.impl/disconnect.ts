import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { DisconnectReason, Server, Socket } from "socket.io";
import ActiveUsersServiceSingleton from "../../../services/users.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { storeGameId } from "../../../utils/storeGameId";

type TDisconnectHandler = (reason: DisconnectReason) => void;

export const factoryDisconnectHandler =
  (
    io: Server<IClientToServerEvents, IServerToClientEvents>,
    socket: Socket<IClientToServerEvents, IServerToClientEvents>,
  ): TDisconnectHandler =>
  (reason: DisconnectReason) => {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId as string | undefined;

    const clientSession = sessions.readSession(clientId ?? "");

    // Logic: If player leaves, broadcast game_over or handle session
    console.log(
      "[factoryDisconnectHandler]",
      "Player disconnected",
      socket.id,
      "due to",
      reason,
    );

    ActiveUsersServiceSingleton.getInstance().removeUser(socket.id);

    if (!clientId || !clientSession || !clientSession.gameId) {
      emitStats(io);
      return;
    }

    if (clientSession?.socketId !== socket.id) {
      // stale-socket guard
      emitStats(io);
      return;
    }
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const warRoom = activeGameRegistry.getRoom(clientSession.gameId);

    if (warRoom) {
      const phase = warRoom.getPhase();
      console.log(
        "[factoryDisconnectHandler] phase",
        phase,
        warRoom.id,
        warRoom.name,
      );
      if (phase === EGamePhase.Playing) {
        clientSession.disconnectedAt = Date.now();
        sessions.updateSession(clientId, clientSession);

        warRoom.deactivatePlayer(clientId);
      } else if (phase === EGamePhase.Placement) {
        if (warRoom.playersCount === 1) {
          if (activeGameRegistry.deleteRoom(clientSession.gameId)) {
            warRoomNames.releaseRoom(warRoom.name);
            storeGameId(clientId, undefined);
          }

          io.emit("open_games", activeGameRegistry.getOpenGames());
          emitStats(io);

          return;
        }
        const remainingPlayerId = warRoom.getOpponent(clientId)?.id;
        if (warRoom.removePlayer(clientId)) {
          storeGameId(clientId, undefined);
        }
        if (remainingPlayerId) {
          const freshRoom = activeGameRegistry.getRoom(clientSession.gameId);
          if (freshRoom) {
            emitRoomStateToPlayers(io, remainingPlayerId, freshRoom.id);
          }
        }
        socket.emit("game_updated", null);
      } else if (phase === EGamePhase.Waiting) {
        if (activeGameRegistry.deleteRoom(clientSession.gameId)) {
          warRoomNames.releaseRoom(warRoom.name);
          storeGameId(clientId, undefined);
        }

        io.emit("open_games", activeGameRegistry.getOpenGames());
        emitStats(io);
        return;
      }

      const freshRoom = activeGameRegistry.getRoom(clientSession.gameId);
      if (freshRoom) {
        const remainingPlayerId =
          freshRoom.getOpponent(clientId)?.id ??
          freshRoom.getPlayer(clientId)?.id ??
          clientSession.id;

        emitRoomStateToPlayers(io, remainingPlayerId, freshRoom.id);
      }
    }
    io.emit("open_games", activeGameRegistry.getOpenGames());
    emitStats(io);
  };
