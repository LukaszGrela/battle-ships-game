import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { storeGameId } from "../../../utils/storeGameId";
import { getSession } from "../../../security/auth";

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
        warRoomNames.releaseRoom(warRoom.name);
        emitRoomStateToPlayers(io, clientId, warRoom.id);
      }
      break;
    case EGamePhase.Placement: {
      const opponent = warRoom.getOpponent(clientId);
      const player = warRoom.getPlayer(clientId);
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
      if (activeGameRegistry.deleteRoom(gameId)) {
        warRoomNames.releaseRoom(warRoom.name);
        storeGameId(clientId, undefined);
      }
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
