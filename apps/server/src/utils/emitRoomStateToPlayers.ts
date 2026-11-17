import { EGamePhase, IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server } from "socket.io";
import ClientSessionServiceSingleton from "../services/client-session.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { BotRunnerService } from "../bots";
import { scheduleFinishedRoomCleanup } from "./roomLifecycle";

export function emitRoomStateToPlayers(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  playerId: string,
  roomId: string,
  playerIdToSkip?: string,
): void {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  const warRoom = activeGameRegistry.getRoom(roomId);

  console.log("[emitRoomStateToPlayers] playerId", playerId);
  console.log("[emitRoomStateToPlayers] warRoom", roomId, warRoom?.name);
  if (!warRoom) return;

  const player = warRoom.getPlayer(playerId);
  const opponent = warRoom.getOpponent(playerId);

  console.log("[emitRoomStateToPlayers] player", player?.name);
  console.log("[emitRoomStateToPlayers] opponent", opponent?.name);

  const session = ClientSessionServiceSingleton.getInstance();

  function updatePlayer(currentPlayerId?: string) {
    console.log("[emitRoomStateToPlayers] updatePlayer()", currentPlayerId);

    if (!currentPlayerId || currentPlayerId === playerIdToSkip) {
      return;
    }
    const playerSession = session.readSession(currentPlayerId);
    if (playerSession) {
      io.to(playerSession.socketId).emit(
        "game_updated",
        warRoom!.getGameState(currentPlayerId),
      );
    }
  }

  if (!player?.isBot) {
    updatePlayer(player?.id);
  }
  if (!opponent?.isBot) {
    updatePlayer(opponent?.id);
  }

  BotRunnerService.getInstance().onRoomStateChanged(roomId);

  // A finished game with a bot never ends on its own: both sides stay in
  // `Finished`, the bot keeps its timers and the room keeps its name. Give
  // the rematch window a deadline; a rematch moves the phase back to
  // `Placement`, so the timer above simply becomes a no-op.
  if (
    warRoom.getPhase() === EGamePhase.Finished &&
    (player?.isBot || opponent?.isBot)
  ) {
    scheduleFinishedRoomCleanup(io, roomId);
  }
}
