import type {
  TCoordinate,
  TShipPlacementOrientation,
} from "@repo/types";

export type TFleetPlacement = {
  coords: TCoordinate;
  orientation: TShipPlacementOrientation;
}[];

/**
 * Random fleet generator used by the bot during the placement phase.
 *
 * `margin = 1` tries to keep the classic "no touching ships" rule; if the
 * room's rules allow touching (or the board got too crowded), `BotPlayer`
 * retries with `margin = 0`. Either way `BattleShips.placeShips()` remains
 * the final judge – it rolls the board back and returns `false` on any
 * invalid placement, and the bot simply tries again.
 */
export function generateFleetPlacement(
  ships: { id: number; size: number }[],
  boardSize: number,
  rng: () => number,
  margin: 0 | 1 = 1,
): TFleetPlacement | null {
  const occupied = new Set<string>();
  const placement: TFleetPlacement = [];

  const collides = (
    coords: TCoordinate,
    orientation: TShipPlacementOrientation,
    size: number,
  ): boolean => {
    for (let k = 0; k < size; k++) {
      const x = coords.x + (orientation === "horizontal" ? k : 0);
      const y = coords.y + (orientation === "vertical" ? k : 0);
      if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) return true;
      if (occupied.has(`${x},${y}`)) return true;
    }
    return false;
  };

  const reserve = (
    coords: TCoordinate,
    orientation: TShipPlacementOrientation,
    size: number,
  ): void => {
    for (let k = 0; k < size; k++) {
      const x = coords.x + (orientation === "horizontal" ? k : 0);
      const y = coords.y + (orientation === "vertical" ? k : 0);
      for (let dy = -margin; dy <= margin; dy++) {
        for (let dx = -margin; dx <= margin; dx++) {
          occupied.add(`${x + dx},${y + dy}`);
        }
      }
    }
  };

  for (const ship of ships) {
    let success = false;
    for (let tries = 0; tries < 300 && !success; tries++) {
      const orientation: TShipPlacementOrientation =
        rng() < 0.5 ? "horizontal" : "vertical";
      const maxX =
        orientation === "horizontal" ? boardSize - ship.size : boardSize - 1;
      const maxY =
        orientation === "horizontal" ? boardSize - 1 : boardSize - ship.size;
      const coords = {
        x: Math.floor(rng() * (maxX + 1)),
        y: Math.floor(rng() * (maxY + 1)),
      };
      if (!collides(coords, orientation, ship.size)) {
        reserve(coords, orientation, ship.size);
        placement.push({ coords, orientation });
        success = true;
      }
    }
    if (!success) return null;
  }

  return placement;
}
