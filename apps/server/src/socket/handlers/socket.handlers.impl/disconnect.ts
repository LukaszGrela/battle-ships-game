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
import { storeGameId } from "../../../utils/storeGameId";
import { getSession } from "../../../security/auth";
import { closeGameRoom } from "../../../utils/roomLifecycle";

type TDisconnectHandler = (reason: DisconnectReason) => void;

export const factoryDisconnectHandler =
  (
    io: Server<IClientToServerEvents, IServerToClientEvents>,
    socket: Socket<IClientToServerEvents, IServerToClientEvents>,
  ): TDisconnectHandler =>
  (reason: DisconnectReason) => {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = getSession(socket).playerId;

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

    if (!clientSession || !clientSession.gameId) {
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
        const opponent = warRoom.getOpponent(clientId);

        // With a bot opponent `playersCount` is 2, but there is nobody left to
        // play against: `removePlayer` would even revert the room to `Waiting`
        // and hand the ownership to the bot, exposing a ghost room in
        // `getOpenGames()`. Tear the room down instead.
        if (opponent?.isBot || warRoom.playersCount === 1) {
          closeGameRoom(io, warRoom.id, "disconnect/placement");
          socket.emit("game_updated", null);
          return;
        }

        const remainingPlayerId = opponent?.id;
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
        closeGameRoom(io, warRoom.id, "disconnect/waiting");
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
