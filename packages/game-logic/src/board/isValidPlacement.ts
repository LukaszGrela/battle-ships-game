import {
  ECellStatus,
  TBoard,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { getCell, TGetCellFailure } from "./cell";

export function cellIsEmpty<S = ECellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
): boolean {
  const cell = getCell(board, coords.x, coords.y);
  return cell === ECellStatus.Empty;
}

export function spaceForShipIsEmpty<S = ECellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
): boolean {
  for (let offset = 0; offset < ship.size; offset++) {
    const cell =
      orientation === "horizontal"
        ? getCell(board, coords.x + offset, coords.y)
        : getCell(board, coords.x, coords.y + offset);
    if (cell !== ECellStatus.Empty) return false;
  }
  return true;
}

export function checkBreathingSpace<S = ECellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
): boolean {
  const validCell = (cell: TGetCellFailure | S): boolean => {
    return (typeof cell === "number" && cell >= 0) ||
      (typeof cell === "string" && cell !== ECellStatus.Empty)
      ? false
      : true;
  };
  const bow =
    orientation === "horizontal"
      ? getCell(board, coords.x + ship.size, coords.y)
      : getCell(board, coords.x, coords.y + ship.size);

  if (!validCell(bow)) {
    return false;
  }

  const stern =
    orientation === "horizontal"
      ? getCell(board, coords.x - 1, coords.y)
      : getCell(board, coords.x, coords.y - 1);

  if (!validCell(stern)) {
    return false;
  }
  console.log("Coords", orientation, coords);
  // Check port and starboard
  for (let offset = 0; offset < ship.size; offset++) {
    const port =
      orientation === "horizontal"
        ? getCell(board, coords.x + offset, coords.y - 1)
        : getCell(board, coords.x + 1, coords.y + offset);
    console.log(
      "Port coords",
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y - 1 }
        : { x: coords.x + 1, y: coords.y + offset },
    );

    if (!validCell(port)) return false;

    const starboard =
      orientation === "horizontal"
        ? getCell(board, coords.x + offset, coords.y + 1)
        : getCell(board, coords.x - 1, coords.y + offset);
    console.log(
      "Starboard coords",
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y + 1 }
        : { x: coords.x - 1, y: coords.y + offset },
    );
    if (!validCell(starboard)) return false;
  }

  return true;
}

type TValidationErrors = -1 | -2 | -3;
export function isValidPlacement<S = ECellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
): TValidationErrors | 1 {
  // 1. clicked cell is empty
  if (!cellIsEmpty(board, coords)) {
    return -1;
  }
  // 2. all cells from clicked cell horizontal or vertical to the ship size are empty
  // 3. ship is within board bounds (outside bounds will not have empty status)
  if (!spaceForShipIsEmpty(board, coords, ship, orientation)) {
    return -2;
  }

  // 4. there is 1 cell space vertical and horizontal
  if (!checkBreathingSpace(board, coords, ship, orientation)) {
    return -3;
  }

  // all good
  return 1;
}
