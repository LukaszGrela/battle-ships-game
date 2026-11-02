import {
  TBoard,
  TCellStatus,
  TCellStatusEmpty,
  TCoordinate,
  TGetCellFailure,
  TPlacementValidationErrors,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { checkCoordsWithinBoard, getCell } from "./cell";

const empty: TCellStatusEmpty = -1;

export const isCellFailure = <S = TCellStatus>(
  cell: S | TGetCellFailure,
): cell is TGetCellFailure => {
  return typeof cell === "number" && cell <= -101 && cell >= -105;
};

export function cellIsEmpty<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  size = 10,
): boolean {
  const cell = getCell<S>(board, coords.x, coords.y, size);
  const empty: TCellStatusEmpty = -1;
  return !isCellFailure(cell) && cell === empty;
}

export function spaceForShipIsEmpty<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
  size = 10,
): boolean {
  for (let offset = 0; offset < ship.size; offset++) {
    const cell =
      orientation === "horizontal"
        ? getCell(board, coords.x + offset, coords.y, size)
        : getCell(board, coords.x, coords.y + offset, size);
    if (cell !== empty) return false;
  }
  return true;
}

export function checkBreathingSpace<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
  size = 10,
): boolean {
  const validCell = (x: number, y: number): boolean => {
    const cell = getCell(board, x, y, size);
    if (isCellFailure(cell)) {
      return x < 0 || x >= size || y < 0 || y >= size;
    }
    return cell === empty;
  };
  const bow =
    orientation === "horizontal"
      ? { x: coords.x + ship.size, y: coords.y }
      : { x: coords.x, y: coords.y + ship.size };

  if (!validCell(bow.x, bow.y)) {
    return false;
  }

  const stern =
    orientation === "horizontal"
      ? { x: coords.x - 1, y: coords.y }
      : { x: coords.x, y: coords.y - 1 };

  if (!validCell(stern.x, stern.y)) {
    return false;
  }
  // Check port and starboard
  for (let offset = 0; offset < ship.size; offset++) {
    const port =
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y - 1 }
        : { x: coords.x + 1, y: coords.y + offset };
    if (!validCell(port.x, port.y)) {
      return false;
    }

    const starboard =
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y + 1 }
        : { x: coords.x - 1, y: coords.y + offset };

    if (!validCell(starboard.x, starboard.y)) {
      return false;
    }
  }

  return true;
}

export function isValidPlacement<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
  size = 10,
): TPlacementValidationErrors | 1 {
  const coordsCheck = checkCoordsWithinBoard(coords.x, coords.y, size);
  if (coordsCheck < 0) {
    return coordsCheck;
  }

  // 1. clicked cell is empty
  if (!cellIsEmpty(board, coords, size)) {
    return -1001;
  }
  // 2. all cells from clicked cell horizontal or vertical to the ship size are empty
  // 3. ship is within board bounds (outside bounds will not have empty status)
  if (!spaceForShipIsEmpty(board, coords, ship, orientation, size)) {
    return -1002;
  }

  // 4. there is 1 cell space vertical and horizontal
  if (!checkBreathingSpace(board, coords, ship, orientation, size)) {
    return -1003;
  }

  // all good
  return 1;
}
