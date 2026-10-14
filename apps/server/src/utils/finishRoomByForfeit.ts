import { TRoomState } from "@repo/types";
import { transitionToFinished } from "./gameLifeCycle";
import ClientSessionServiceSingleton from "../services/client-session.service";

export function finishRoomByForfeit(
  roomId: string,
  forfeitingPlayerId: string,
): TRoomState | undefined {
  const room = transitionToFinished(roomId, forfeitingPlayerId, true);
  if (room) {
    const sessions = ClientSessionServiceSingleton.getInstance();

    // clear session for all players
    Object.values(room.players).forEach((player) => {
      sessions.clearSessionGame(player.id);
    });
  }
  return room;
}
