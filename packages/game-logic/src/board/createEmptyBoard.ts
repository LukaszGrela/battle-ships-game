import { TBoard, TCellStatus, TCellStatusEmpty } from "@repo/types";

const empty:TCellStatusEmpty = -1;

export function createEmptyBoard<S = TCellStatus>(
  size = 10,
  fill: S = empty as S,
): TBoard<S> {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(fill));
}
