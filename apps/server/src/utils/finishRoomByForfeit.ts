import { TRoomState } from "@repo/types";
import { transitionToFinished } from "./gameLifeCycle";

export function finishRoomByForfeit(
  roomId: string,
  forfeitingPlayerId: string,
): TRoomState | undefined {
  return transitionToFinished(roomId, forfeitingPlayerId, true);
}
