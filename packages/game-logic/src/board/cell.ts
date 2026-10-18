import { ECellStatus, TBoard } from "@repo/types";

type TInvalidXCoordinate = -101;
type TInvalidYCoordinate = -102;
type TInvalidRow = -103;
type TInvalidCell = -104;
type TUnknownError = -105;
export type TGetCellFailure =
  | TInvalidXCoordinate
  | TInvalidYCoordinate
  | TInvalidRow
  | TInvalidCell
  | TUnknownError;

export function getCell<S = ECellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
): S | TGetCellFailure {
  if (x < 0 || x > 9) return -101;
  if (y < 0 || y > 9) return -102;

  const row = board.at(y);
  if (row == undefined) {
    return -103;
  }
  const cell = row.at(x);
  if (cell == undefined) {
    return -104;
  }
  return cell;
}

export function setCell<S = ECellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
  value: S,
): 1 | TGetCellFailure {
  if (x < 0 || x > 9) return -101;
  if (y < 0 || y > 9) return -102;

  const row = board.at(y);
  if (row == undefined) {
    return -103;
  }
  const cell = row.at(x);
  if (cell == undefined) {
    return -104;
  }

  // update cell
  row[x] = value;

  return 1;
}
