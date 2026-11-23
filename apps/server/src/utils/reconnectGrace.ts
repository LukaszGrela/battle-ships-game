import { Server } from "socket.io";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { closeGameRoom, scheduleFinishedRoomCleanup } from "./roomLifecycle";

export const DEFAULT_RECONNECT_TIMEOUT_MS = 60_000;

/**
 * Deadline granted to every player right after a restore. `undefined` means the
 * server did not restart and the regular timeout applies.
 */
let restartGraceDeadline: number | undefined;
let restartGraceTimer: NodeJS.Timeout | undefined;

export function beginRestartGrace(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;

  restartGraceDeadline = Date.now() + ms;

  // Only kept as a handle so a test (or a second restore) can clear it; the
  // deadline itself is a timestamp, not a timer that acts on its own.
  if (restartGraceTimer) clearTimeout(restartGraceTimer);
  restartGraceTimer = setTimeout(() => {
    restartGraceTimer = undefined;
  }, ms);
  restartGraceTimer.unref?.();
}

export function disposeRestartGrace(): void {
  if (restartGraceTimer) clearTimeout(restartGraceTimer);
  restartGraceTimer = undefined;
  restartGraceDeadline = undefined;
}

export function getRestartGraceDeadline(): number | undefined {
  return restartGraceDeadline;
}

export function getReconnectTimeoutMs(): number {
  const configured = Number(process.env.GAME_RECONNECT_TIMEOUT_MS ?? "");

  const base =
    !Number.isFinite(configured) || configured <= 0
      ? DEFAULT_RECONNECT_TIMEOUT_MS
      : configured;

  if (restartGraceDeadline === undefined) {
    return base;
  }

  // After a restart the clock starts when the players could reconnect, not when
  // the old process wrote the snapshot: the whole window is still ahead.
  const remaining = restartGraceDeadline - Date.now();

  return remaining > base ? remaining : base;
}

export function expireDisconnectedPlayers(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
): void {
  const sessions = ClientSessionServiceSingleton.getInstance();
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  const timeoutMs = getReconnectTimeoutMs();
  const now = Date.now();

  for (const session of sessions.listSessions()) {
    if (!session.gameId || typeof session.disconnectedAt !== "number") {
      continue;
    }

    if (now - session.disconnectedAt < timeoutMs) {
      continue;
    }

    const warRoom = activeGameRegistry.getRoom(session.gameId);

    if (!warRoom || warRoom.getPhase() !== EGamePhase.Playing) {
      sessions.clearSessionGame(session.id);

      // A disconnected human in `Placement`/`Waiting` never comes back here:
      // when the opponent is a bot nobody else can finish or release the room.
      if (
        warRoom &&
        warRoom.getPhase() !== EGamePhase.Finished &&
        warRoom.getOpponent(session.id)?.botLevel
      ) {
        closeGameRoom(io, warRoom.id, "reconnect-timeout/non-playing");
      }

      continue;
    }
    if (warRoom.forfeit(session.id)) {
      console.log(
        "[expireDisconnectedPlayers]",
        "Session",
        session.id,
        "in room",
        warRoom?.id,
        "has forfeited",
      );
      emitRoomStateToPlayers(io, session.id, warRoom.id);

      // Forfeited room is `Finished` now: either it waits for a rematch, or
      // it has to be torn down (a bot cannot rematch with nobody).
      const humansLeft = warRoom
        .getPlayers()
        .filter((player) => !player.botLevel && player.active);

      if (humansLeft.length === 0) {
        closeGameRoom(io, warRoom.id, "reconnect-timeout/forfeited");
      } else {
        scheduleFinishedRoomCleanup(io, warRoom.id);
      }
    }
  }
}
