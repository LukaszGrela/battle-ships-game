import { TRoomState } from "@repo/types";

export function singleUser(state: TRoomState): boolean {
  return (
    Object.values(state.players).filter(({ active }) => active).length === 1
  );
}
