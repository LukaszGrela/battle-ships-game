import { TShip } from "@repo/types";

export const isSunk = (ship: TShip) =>
  ship.type === "placed" && ship.hits.length >= ship.size;
