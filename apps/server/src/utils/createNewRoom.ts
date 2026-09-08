import { createEmptyBoard } from "@repo/game-logic";
import { EGamePhase, IPlayer, TRoomIdentity, TRoomState } from "@repo/types";

export function createNewRoom(
  identifier: Pick<TRoomIdentity, "id" | "name">,
  firstPlayer: IPlayer,
): TRoomState {
  return {
    ...identifier,
    boards: {
      [firstPlayer.id]: createEmptyBoard(),
    },
    game_created: new Date().toISOString(),
    game_started: null,
    game_finished: null,
    history: [],
    phase: EGamePhase.Waiting,
    players: {
      [firstPlayer.id]: firstPlayer,
    },
    result: {},
    ships: {},
    turn: firstPlayer.id,
  };
}
