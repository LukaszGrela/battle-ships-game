import { ECellStatus } from "@repo/types";

export function createEmptyBoard() {
  return Array(10)
    .fill(null)
    .map(() => Array(10).fill(ECellStatus.Empty));
}
