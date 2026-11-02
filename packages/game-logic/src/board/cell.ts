import {
  TBoard,
  TCellStatus,
  TGetCellFailure,
  TInvalidXCoordinate,
  TInvalidYCoordinate,
} from "@repo/types";

export function getCell<S = TCellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
  size = 10,
): S | TGetCellFailure {
  const coordsCheck = checkCoordsWithinBoard(x, y, size);
  if (coordsCheck !== 1) return coordsCheck;

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

export function setCell<S = TCellStatus>(
  board: TBoard<S>,
  x: number,
  y: number,
  value: S,
  size = 10,
): S | TGetCellFailure {
  const coordsCheck = checkCoordsWithinBoard(x, y, size);
  if (coordsCheck !== 1) return coordsCheck;

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

  return value;
}

export function checkCoordsWithinBoard(
  x: number,
  y: number,
  size = 10,
): TInvalidXCoordinate | TInvalidYCoordinate | 1 {
  if (x < 0 || x >= size) return -101;
  if (y < 0 || y >= size) return -102;

  return 1;
}
