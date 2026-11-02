import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server } from "socket.io";
import ClientSessionServiceSingleton from "../services/client-session.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";

export function emitRoomStateToPlayers(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  playerId: string,
  roomId: string,
  playerIdToSkip?: string,
): void {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  const warRoom = activeGameRegistry.getRoom(roomId);

  console.log("[emitRoomStateToPlayers2] warRoom", warRoom?.name);
  if (!warRoom) return;

  const player = warRoom.getPlayer(playerId);
  const opponent = warRoom.getOpponent(playerId);

  const session = ClientSessionServiceSingleton.getInstance();

  function updatePlayer(currentPlayerId?: string) {
    console.log("[emitRoomStateToPlayers2] updatePlayer()", currentPlayerId);

    if (!currentPlayerId || currentPlayerId === playerIdToSkip) {
      return;
    }
    const playerSession = session.readSession(currentPlayerId);
    if (playerSession) {
      console.log("game_updated", warRoom!.getGameState(currentPlayerId));
      io.to(playerSession.socketId).emit(
        "game_updated",
        warRoom!.getGameState(currentPlayerId),
      );
    }
  }

  updatePlayer(player?.id);
  updatePlayer(opponent?.id);
}
