import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { storeGameId } from "../../../utils/storeGameId";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { getSession } from "../../../security/auth";

type TLeaveGameHandler = IClientToServerEvents["leave_game"];

export const factoryLeaveGameHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TLeaveGameHandler => {
  return () => {
    const session = ClientSessionServiceSingleton.getInstance();

    const clientId = getSession(socket).playerId;

    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      socket.emit(
        "error",
        "Invalid session or game state. Can't leave a game, you're not joined.",
      );
      return;
    }

    const warRoom = activeGameRegistry.getRoom(clientSession.gameId);

    if (warRoom) {
      const phase = warRoom.getPhase();
      if (phase === EGamePhase.Waiting) {
        if (activeGameRegistry.deleteRoom(clientSession.gameId)) {
          warRoomNames.releaseRoom(warRoom.name);
          storeGameId(clientId, undefined);
        }
        socket.emit("game_updated", null);
      } else if (phase === EGamePhase.Placement) {
        const opponent = warRoom.getOpponent(clientId);
        const self = warRoom.getPlayer(clientId);
        if (warRoom.removePlayer(clientId)) {
          storeGameId(clientId, undefined);
          if (opponent) {
            const opponentSession = session.readSession(opponent.id);
            if (opponentSession?.socketId) {
              io.to(opponentSession.socketId).emit(
                "player_left",
                self && {
                  id: self.id,
                  name: self.name,
                  seed: self.seed,
                },
              );
              io.to(opponentSession.socketId).emit(
                "game_updated",
                warRoom.getGameState(opponent.id),
              );
            }
          }
        }
        socket.emit("game_updated", null);
      } else if (phase === EGamePhase.Playing) {
        if (warRoom.forfeit(clientId)) {
          warRoomNames.releaseRoom(warRoom.name);
          emitRoomStateToPlayers(io, clientId, warRoom.id);
        }
      } else if (phase === EGamePhase.Finished) {
        // notify opponent that the player has left the game, in case they are waiting for a rematch or something
        const self = warRoom.getPlayer(clientId);
        const opponent = warRoom.getOpponent(clientId);

        if (opponent) {
          const opponentSession = session.readSession(opponent.id);
          if (opponent.active && opponentSession && opponentSession.socketId) {
            io.to(opponentSession.socketId).emit(
              "player_left",
              self && {
                seed: self.seed,
                name: self.name,
                id: self.id,
              },
            );
          }
        }
        //
        warRoom.deactivatePlayer(clientId);
        // clear session for leaving player players
        session.clearSessionGame(clientId);
        return;
      } else {
        warRoom.deactivatePlayer(clientId);
        const opponent = warRoom.getOpponent(clientId);
        if (opponent) warRoom.deactivatePlayer(opponent.id);

        emitRoomStateToPlayers(io, clientId, warRoom.id);
        storeGameId(clientId, undefined);
        activeGameRegistry.deleteRoom(clientSession.gameId);
        socket.emit("game_updated", null);
      }
    } else {
      storeGameId(clientId, undefined);

      socket.emit("error", "No game to leave");
    }

    io.emit("open_games", activeGameRegistry.getOpenGames());
    emitStats(io);
  };
};
