import { TShip } from "@repo/types";

export function getShips(
  playerIds: string[],
  shipSizes: number[],
): Record<string, TShip[]> {
  return playerIds.reduce(
    (acc, id) => {
      return {
        ...acc,
        [id]: shipSizes.map((size, index): TShip => ({
          id: index,
          type: "pending",
          size,
          placed: false,
        })),
      };
    },
    {} as Record<string, TShip[]>,
  );
}
