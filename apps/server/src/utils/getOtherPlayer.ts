import { IPlayer } from "@repo/types";

export function getOtherPlayer(
  playerId: string,
  players: Record<string, IPlayer>,
): IPlayer | undefined {
  return Object.values(players).find((value) => value.id != playerId);
}
