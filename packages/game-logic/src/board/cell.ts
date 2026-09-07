import { ECellStatus, TBoard } from "@repo/types";

type TInvalidXCoordinate = -1;
type TInvalidYCoordinate = -2;
type TInvalidRow = -3;
type TInvalidCell = -4;
type TUnknownError = -5;
export type TGetCellFailure =
  TInvalidXCoordinate | TInvalidYCoordinate | TInvalidCell | TInvalidRow;

export function getCell<S = ECellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
): S | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (row == undefined) {
    return -3;
  }
  const cell = row.at(x);
  if (cell == undefined) {
    return -4;
  }
  return cell;
}

export function setCell<S = ECellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
  value: S,
): 1 | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (row == undefined) {
    return -3;
  }
  const cell = row.at(x);
  if (cell == undefined) {
    return -4;
  }

  // update cell
  row[x] = value;

  return 1;
}
