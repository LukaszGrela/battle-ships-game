import { ECellStatus } from "@repo/types";

type TInvalidXCoordinate = -1;
type TInvalidYCoordinate = -2;
type TUnknownError = -3;
type TGetCellFailure =
  TInvalidXCoordinate | TInvalidYCoordinate | TUnknownError;

export function getCell(
  board: ECellStatus[][],
  x: number,
  y: number,
): ECellStatus | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (!row) {
    return -3;
  }
  const cell = row.at(x);
  if (!cell) {
    return -3;
  }
  return cell;
}

export function setCell(
  board: ECellStatus[][],
  x: number,
  y: number,
  value: ECellStatus,
): 0 | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (!row) {
    return -3;
  }
  const cell = row.at(x);
  if (!cell) {
    return -3;
  }

  // update cell
  row[x] = value;

  return 0;
}
