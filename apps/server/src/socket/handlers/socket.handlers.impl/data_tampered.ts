import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { storeGameId } from "../../../utils/storeGameId";
import { getSession } from "../../../security/auth";
import {
  closeGameRoom,
  scheduleFinishedRoomCleanup,
} from "../../../utils/roomLifecycle";

function resolveAbandonedRoom(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  clientId: string,
  gameId: string,
): void {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
  const sessions = ClientSessionServiceSingleton.getInstance();
  const warRoom = activeGameRegistry.getRoom(gameId);

  if (!warRoom || !warRoom.hasPlayer(clientId)) {
    return;
  }

  switch (warRoom.getPhase()) {
    case EGamePhase.Playing:
      if (warRoom.forfeit(clientId)) {
        emitRoomStateToPlayers(io, clientId, warRoom.id);

        const humansLeft = warRoom
          .getPlayers()
          .filter((player) => !player.botLevel && player.active);

        if (humansLeft.length === 0) {
          closeGameRoom(io, gameId, "data-tampered/forfeit");
        } else {
          scheduleFinishedRoomCleanup(io, gameId);
        }
      }
      break;
    case EGamePhase.Placement: {
      const opponent = warRoom.getOpponent(clientId);
      const player = warRoom.getPlayer(clientId);

      // A bot opponent cannot accept anything – drop the whole room, also
      // because `removePlayer` would revert the phase to `Waiting`.
      if (opponent?.botLevel) {
        closeGameRoom(io, gameId, "data-tampered/placement-bot");
        break;
      }

      if (warRoom.removePlayer(clientId)) {
        storeGameId(clientId, undefined);
        if (opponent) {
          const opponentSession = sessions.readSession(opponent.id);
          if (opponentSession) {
            io.to(opponentSession.socketId).emit(
              "player_left",
              player && {
                id: player.id,
                name: player.name,
                seed: player.seed,
              },
            );
            io.to(opponentSession.socketId).emit(
              "game_updated",
              warRoom.getGameState(opponent.id),
            );
          }
        }
      }
      break;
    }
    case EGamePhase.Waiting:
      closeGameRoom(io, gameId, "data-tampered/waiting");
      break;
    case EGamePhase.Finished: {
      const player = warRoom.getPlayer(clientId);
      const opponent = warRoom.getOpponent(clientId);
      if (opponent) {
        const opponentSession = sessions.readSession(opponent.id);
        if (opponent.active && opponentSession) {
          io.to(opponentSession.socketId).emit(
            "player_left",
            player && {
              id: player.id,
              name: player.name,
              seed: player.seed,
            },
          );
        }
      }
      warRoom.deactivatePlayer(clientId);

      const humansLeft = warRoom
        .getPlayers()
        .filter((player) => !player.botLevel && player.active);

      if (humansLeft.length === 0) {
        closeGameRoom(io, gameId, "data-tampered/finished");
      } else {
        scheduleFinishedRoomCleanup(io, gameId);
      }
      break;
    }
  }
}

export const dataTampered = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const sessions = ClientSessionServiceSingleton.getInstance();
  const clientId = getSession(socket).playerId;
  const clientSession = sessions.readSession(clientId);

  console.group("[dataTampered]");
  console.error("clientId", clientId);
  console.error("clientSession", clientSession);
  console.error("socket.id", socket.id);
  console.groupEnd();

  const isCurrentSocket = clientSession?.socketId === socket.id;
  if (isCurrentSocket && clientSession.gameId) {
    resolveAbandonedRoom(io, clientId, clientSession.gameId);
  }

  socket.emit("error", "Internal server error");
  socket.emit("game_updated", null);
  if (isCurrentSocket) {
    sessions.deleteSession(clientId);
  }
  socket.disconnect(true);

  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
  io.emit("open_games", activeGameRegistry.getOpenGames());
  emitStats(io);
};
