import { TShip } from "@repo/types";

export function getShip(shipSize: number, id: number): TShip {
  return {
    id,
    type: "pending",
    size: shipSize,
    placed: false,
  };
}
