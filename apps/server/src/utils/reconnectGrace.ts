import { Server } from "socket.io";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../services/active-game-registry";

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
      continue;
    }

    if (warRoom.forfeit(session.id)) {
      emitRoomStateToPlayers(io, session.id, warRoom.id);
    }
  }
}
