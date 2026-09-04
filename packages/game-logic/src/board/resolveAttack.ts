import { ECellStatus, TCoordinate } from "@repo/types";
import { getCell } from "./cell";

/**
 * Determines if a move results in a hit or miss.
 */
export const resolveAttack = (
  board: ECellStatus[][],
  coord: TCoordinate,
): ECellStatus => {
  const current = getCell(board, coord.x, coord.y);
  if (current === ECellStatus.Ship) return ECellStatus.Hit;
  return ECellStatus.Miss;
};
