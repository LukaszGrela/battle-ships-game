import { EGamePhase } from "@repo/types";
import type { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import type { Server } from "socket.io";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import ClientSessionServiceSingleton from "../services/client-session.service";
import type { WarRoom } from "../services/WarRoom";
import { cancelRematchTimeout, ensureRematchTimeout } from "./rematchTimeout";

/**
 * Rematch notifications shared by both entry points:
 *  - the socket handlers (human initiated requests / accepts),
 *  - `BotRunnerService` (the bot has no socket, so it cannot emit itself).
 *
 * Keeping them in one place makes the three supported directions behave the
 * same: human vs human, human asks a bot, bot asks a human.
 */

const getRoom = (roomId: string): WarRoom | undefined =>
  ActiveGameRegistrySingleton.getInstance().getRoom(roomId);

/**
 * Announces a pending rematch request to the other human player and starts the
 * accept/reject deadline.
 *
 * The requestor may be a bot. The opponent may be a bot too - it has no
 * session, so only the deadline applies and the room-state broadcast (issued
 * by the caller) is what wakes it.
 *
 * @returns `true` when a pending request was announced.
 */
export const notifyRematchRequested = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  roomId: string,
  requestorId: string,
): boolean => {
  const room = getRoom(roomId);
  if (!room || room.getPhase() !== EGamePhase.Finished) return false;

  const request = room.getGameState(requestorId)?.rematchRequest;
  if (request?.status !== "pending") return false;

  const requestor = room.getPlayer(requestorId);
  const opponent = room.getOpponent(requestorId);

  if (opponent && !opponent.botLevel) {
    const opponentSession =
      ClientSessionServiceSingleton.getInstance().readSession(opponent.id);
    if (opponentSession) {
      io.to(opponentSession.socketId).emit("rematch_requested", {
        requestId: request.requestId,
        requestorId,
        status: "pending",
        name: requestor?.name ?? "",
        seed: requestor?.seed ?? 0,
        expiresAt: request.expiresAt,
      });
    }
  }

  ensureRematchTimeout(io, roomId, requestorId);
  return true;
};

/**
 * Announces an accepted rematch and clears the accept/reject deadline.
 * Safe for both human and bot acceptors - a bot simply has no session to
 * update.
 */
export const notifyRematchAccepted = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  roomId: string,
): boolean => {
  const room = getRoom(roomId);
  if (!room) return false;

  const sessionService = ClientSessionServiceSingleton.getInstance();
  for (const player of room.getPlayers()) {
    const session = sessionService.readSession(player.id);
    if (!session) continue;
    session.gameId = room.id;
    sessionService.updateSession(player.id, session);
  }

  cancelRematchTimeout(roomId);

  io.to(room.id).emit("rematch_accepted", {
    roomId: room.id,
    status: "accepted",
  });

  return true;
};
