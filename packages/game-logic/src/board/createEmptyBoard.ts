import { ECellStatus, TBoard } from "@repo/types";

export function createEmptyBoard<S = ECellStatus>(
  size = 10,
  fill: S = ECellStatus.Miss as S,
): TBoard<S> {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(fill));
}
