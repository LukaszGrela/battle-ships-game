import { Server } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import RoomServiceSingleton from "../services/room.service";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";
import { finishRoomByForfeit } from "./finishRoomByForfeit";

export const DEFAULT_RECONNECT_TIMEOUT_MS = 60_000;

export function getReconnectTimeoutMs(): number {
  const configured = Number(process.env.GAME_RECONNECT_TIMEOUT_MS ?? "");

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_RECONNECT_TIMEOUT_MS;
  }

  return configured;
}

export function expireDisconnectedPlayers(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
): void {
  const sessions = ClientSessionServiceSingleton.getInstance();
  const rooms = RoomServiceSingleton.getInstance();
  const timeoutMs = getReconnectTimeoutMs();
  const now = Date.now();

  for (const session of sessions.listSessions()) {
    if (!session.gameId || typeof session.disconnectedAt !== "number") {
      continue;
    }

    if (now - session.disconnectedAt < timeoutMs) {
      continue;
    }

    const room = rooms.getRoom(session.gameId);
    if (!room || room.phase !== "playing") {
      sessions.clearSessionGame(session.id);
      continue;
    }

    const updatedRoom = finishRoomByForfeit(room.id, session.id);
    if (updatedRoom) {
      emitRoomStateToPlayers(io, updatedRoom);
    }
  }
}
