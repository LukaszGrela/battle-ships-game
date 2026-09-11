import { IPlayer } from "@repo/types";

export function getPlayerById(
  playerId: string,
  players: Record<string, IPlayer>,
): IPlayer | undefined {
  // console.log("getPlayerById", playerId, players);
  return Object.values(players).find((value) => value.id == playerId);
}
