import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server } from "socket.io";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { REMATCH_REQUEST_TIMEOUT_MS } from "../config/rematch";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";

const pendingRematchTimeouts = new Map<string, NodeJS.Timeout>();

type TIoServer = Server<IClientToServerEvents, IServerToClientEvents>;

export const cancelRematchTimeout = (roomId: string): void => {
  const timer = pendingRematchTimeouts.get(roomId);
  if (!timer) return;

  clearTimeout(timer);
  pendingRematchTimeouts.delete(roomId);
};

/**
 * Auto-cancels a pending request after the timeout and informs both players.
 * The request stays in the room state with status `cancelled`, so no new
 * request can be sent for that finished game.
 */
export const scheduleRematchTimeout = (
  io: TIoServer,
  roomId: string,
  requestorId: string,
  timeoutMs: number = REMATCH_REQUEST_TIMEOUT_MS,
): void => {
  cancelRematchTimeout(roomId);

  const timer = setTimeout(() => {
    pendingRematchTimeouts.delete(roomId);

    const warRoom = ActiveGameRegistrySingleton.getInstance().getRoom(roomId);
    if (!warRoom) return;

    if (warRoom.expireRematch() < 1) return;

    notifyRematchCancelled(io, roomId, requestorId, "timeout");
  }, timeoutMs);

  timer.unref?.();
  pendingRematchTimeouts.set(roomId, timer);
};

/**
 * Schedules the timeout at most once per room. State broadcasts happen often,
 * so re-scheduling on every broadcast would postpone the deadline forever.
 */
export const ensureRematchTimeout = (
  io: TIoServer,
  roomId: string,
  requestorId: string,
  expiresAt?: string,
): void => {
  if (pendingRematchTimeouts.has(roomId)) return;

  const parsedExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const remaining = Number.isNaN(parsedExpiry)
    ? REMATCH_REQUEST_TIMEOUT_MS
    : Math.max(0, parsedExpiry - Date.now());

  scheduleRematchTimeout(io, roomId, requestorId, remaining);
};

/** Emits `rematch_cancelled` to both human players and refreshes room state. */
export const notifyRematchCancelled = (
  io: TIoServer,
  roomId: string,
  requestorId: string,
  reason: "cancelled" | "timeout",
): void => {
  const warRoom = ActiveGameRegistrySingleton.getInstance().getRoom(roomId);
  if (!warRoom) return;

  const sessionService = ClientSessionServiceSingleton.getInstance();
  const playerIds = [requestorId, warRoom.getOpponent(requestorId)?.id];

  for (const playerId of playerIds) {
    if (!playerId) continue;
    const player = warRoom.getPlayer(playerId);
    if (!player || player.botLevel) continue;

    const playerSession = sessionService.readSession(playerId);
    if (!playerSession) continue;

    io.to(playerSession.socketId).emit("rematch_cancelled", {
      roomId,
      requestorId,
      status: "cancelled",
      reason,
    });
  }

  emitRoomStateToPlayers(io, requestorId, roomId);
};
