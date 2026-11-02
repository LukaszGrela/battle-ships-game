import {
  TBoard,
  TCellStatus,
  TCellStatusEmpty,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { setCell } from "./cell";

const empty: TCellStatusEmpty = -1;

export function placeShip<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
) {
  for (let offset = 0; offset < ship.size; offset++) {
    const placementCoords =
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y }
        : { x: coords.x, y: coords.y + offset };

    setCell<S>(board, placementCoords.x, placementCoords.y, ship.id as S);
  }
}

export function removeShip<S = TCellStatus>(
  board: TBoard<S>,
  coords: TCoordinate,
  ship: TShip,
  orientation: TShipPlacementOrientation,
) {
  for (let offset = 0; offset < ship.size; offset++) {
    const placementCoords =
      orientation === "horizontal"
        ? { x: coords.x + offset, y: coords.y }
        : { x: coords.x, y: coords.y + offset };

    setCell<S>(board, placementCoords.x, placementCoords.y, empty as S);
  }
}
