import { ECellStatus, TBoard } from "@repo/types";

export function createEmptyBoard(): TBoard {
  return Array(10)
    .fill(null)
    .map(() => Array(10).fill(ECellStatus.Empty));
}
