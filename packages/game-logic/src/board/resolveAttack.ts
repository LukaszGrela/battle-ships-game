import { ECellStatus, TBoard, TCoordinate } from "@repo/types";
import { getCell } from "./cell";

/**
 * Determines if a move results in a hit or miss.
 */
export const resolveAttack = (
  board: TBoard<ECellStatus | number>,
  coord: TCoordinate,
): ECellStatus.Hit | ECellStatus.Miss => {
  const current = getCell(board, coord.x, coord.y);
  if (
    current === ECellStatus.Ship ||
    (typeof current === "number" && current >= 0)
  )
    return ECellStatus.Hit;
  return ECellStatus.Miss;
};
