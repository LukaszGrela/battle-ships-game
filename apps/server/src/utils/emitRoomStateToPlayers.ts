import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server } from "socket.io";
import ClientSessionServiceSingleton from "../services/client-session.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { BotRunnerService } from "../bots";
import { scheduleFinishedRoomCleanup } from "./roomLifecycle";
import { ensureRematchTimeout } from "./rematchTimeout";
import { recordFinishedGame } from "./recordFinishedGame";
import { emitStats } from "./emitStats";

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

  const roomState = warRoom.getGameState(playerId);
  const rematchRequest = roomState?.rematchRequest;

  if (rematchRequest?.status === "pending") {
    ensureRematchTimeout(
      io,
      roomId,
      rematchRequest.requestorId,
      rematchRequest.expiresAt,
    );
  }

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

  if (!player?.botLevel) {
    updatePlayer(player?.id);
  }
  if (!opponent?.botLevel) {
    updatePlayer(opponent?.id);
  }

  BotRunnerService.getInstance().onRoomStateChanged(roomId);

  if (warRoom.getPhase() === EGamePhase.Finished) {
    // Every path that can end a battle (attack, forfeit, leave, disconnect,
    // data tampering) funnels through a room state broadcast. Recording here
    // keeps the statistics independent of how the game ended; the recorder is
    // idempotent, so the second player's broadcast does not double count.
    if (recordFinishedGame(roomId)?.recorded) {
      emitStats(io);
    }
  }

  // A finished game with a bot never ends on its own: both sides stay in
  // `Finished`, the bot keeps its timers and the room keeps its name. Give
  // the rematch window a deadline; a rematch moves the phase back to
  // `Placement`, so the timer above simply becomes a no-op.
  if (
    warRoom.getPhase() === EGamePhase.Finished &&
    (player?.botLevel || opponent?.botLevel)
  ) {
    scheduleFinishedRoomCleanup(io, roomId);
  }
}
