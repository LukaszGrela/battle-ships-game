import {
  ECellStatus,
  TBoard,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { setCell } from "./cell";

export function placeShip<S = ECellStatus>(
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
