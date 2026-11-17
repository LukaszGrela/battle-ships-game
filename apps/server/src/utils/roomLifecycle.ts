import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server } from "socket.io";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { warRoomNames } from "../services/WarRoomName.service";
import { BotRunnerService } from "../bots";
import { storeGameId } from "./storeGameId";
import { emitStats } from "./emitStats";

/** A finished room is kept alive for a possible rematch, but not forever. */
export const FINISHED_ROOM_TTL_MS = 5 * 60 * 1000;

const pendingFinishedCleanups = new Map<string, NodeJS.Timeout>();

/**
 * Single teardown path for a room that will never be played again.
 *
 * Order matters:
 *  1. cancel the finished-room TTL timer (no double teardown),
 *  2. dispose the bot – it holds timers and a reference to the room,
 *  3. delete the room from the registry,
 *  4. release the room name only after the room is really gone,
 *  5. drop `gameId` from every human session of that room,
 *  6. broadcast `open_games` + `server_stats`.
 *
 * Idempotent: safe for an already closed room and for a room whose creation
 * failed half way (no bot, no registry entry).
 */
export const closeGameRoom = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  roomId: string,
  reason = "unknown",
): boolean => {
  cancelFinishedRoomCleanup(roomId);

  const registry = ActiveGameRegistrySingleton.getInstance();
  const warRoom = registry.getRoom(roomId);

  const humanPlayerIds = (warRoom?.getPlayers() ?? [])
    .filter((player) => !player.isBot)
    .map((player) => player.id);

  // The bot is disposed before the room disappears: `disposeBot` removes its
  // player from the room and clears the pending timeout / poll interval.
  BotRunnerService.getInstance().removeBot(roomId);

  const deletedRoom = registry.deleteRoom(roomId);
  if (deletedRoom) {
    warRoomNames.releaseRoom(deletedRoom.name);
  }

  for (const playerId of humanPlayerIds) {
    storeGameId(playerId, undefined);
  }

  io.emit("open_games", registry.getOpenGames());
  emitStats(io);

  console.log(
    "[roomLifecycle] closed room",
    roomId,
    deletedRoom?.name ?? "-",
    reason,
  );

  return Boolean(deletedRoom);
};

/**
 * Schedules the final teardown of a finished room. Called on every transition
 * into `EGamePhase.Finished`; the rematch flow keeps the room alive because an
 * accepted rematch moves the phase back to `Placement` and the next `Finished`
 * schedules a new timer.
 */
export const scheduleFinishedRoomCleanup = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  roomId: string,
  ttlMs: number = FINISHED_ROOM_TTL_MS,
): void => {
  if (pendingFinishedCleanups.has(roomId)) return;

  const timer = setTimeout(() => {
    pendingFinishedCleanups.delete(roomId);

    const room = ActiveGameRegistrySingleton.getInstance().getRoom(roomId);
    if (!room) {
      // Orphaned bot (room gone) – make sure nothing keeps polling.
      BotRunnerService.getInstance().removeBot(roomId);
      return;
    }

    // Rematch started in the meantime: the room is alive again and the next
    // transition into `Finished` will schedule a fresh cleanup.
    if (room.getPhase() !== EGamePhase.Finished) return;

    closeGameRoom(io, roomId, "finished-ttl");
  }, ttlMs);

  timer.unref?.();
  pendingFinishedCleanups.set(roomId, timer);
};

export const cancelFinishedRoomCleanup = (roomId: string): void => {
  const timer = pendingFinishedCleanups.get(roomId);
  if (!timer) return;

  clearTimeout(timer);
  pendingFinishedCleanups.delete(roomId);
};

/** Server shutdown: drop every pending room timer. */
export const disposeRoomLifecycle = (): void => {
  for (const timer of pendingFinishedCleanups.values()) {
    clearTimeout(timer);
  }
  pendingFinishedCleanups.clear();
};

/** Number of rooms waiting for their TTL teardown (tests / diagnostics). */
export const pendingRoomCleanupCount = (): number =>
  pendingFinishedCleanups.size;
