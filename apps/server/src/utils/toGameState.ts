import {
  ECellStatus,
  EGamePhase,
  TBoard,
  TGameState,
  TRoomState,
} from "@repo/types";
import { getPlayerById } from "./getPlayerById";
import { getOtherPlayer } from "./getOtherPlayer";
import { isSunk } from "@repo/game-logic";

export function toGameState(playerId: string, state: TRoomState): TGameState {
  // console.log("toGameState", playerId, state);
  const player = getPlayerById(playerId, state.players)!;
  // console.log("player", player);
  if (state.phase === EGamePhase.Waiting) {
    return {
      id: state.id,
      name: state.name,
      phase: EGamePhase.Waiting,
      game_created: state.game_created,
      game_finished: state.game_finished,
      game_started: state.game_started,
      result: state.result,
      turn: state.turn,
      self: player,
      myBoard: state.boards[player.id] ?? [],
    };
  } else if (state.phase === "placement") {
    const enemy = getOtherPlayer(playerId, state.players)!;
    return {
      id: state.id,
      name: state.name,
      phase: EGamePhase.Placement,
      game_created: state.game_created,
      game_finished: state.game_finished,
      game_started: state.game_started,
      result: state.result,
      turn: state.turn,
      self: player,
      enemy,
      myBoard: state.boards[player.id] ?? [],
      ships: state.ships[player.id] ?? [],
    };
  } else {
    const enemy = getOtherPlayer(playerId, state.players)!;
    const enemyShips = state.ships[enemy.id] ?? [];
    if (state.phase === "finished") {
      return {
        id: state.id,
        name: state.name,
        phase: state.phase,
        game_created: state.game_created,
        game_finished: state.game_finished,
        game_started: state.game_started,
        result: state.result,
        turn: state.turn,
        self: player,
        enemy,
        ships: state.ships[player.id] ?? [],
        myBoard: state.boards[player.id] ?? [],
        enemyBoard: state.boards[enemy.id] ?? [],
        enemyDestroyedShips: enemyShips,
      };
    } else {
      return {
        id: state.id,
        name: state.name,
        phase: state.phase as EGamePhase.Playing,
        game_created: state.game_created,
        game_finished: state.game_finished,
        game_started: state.game_started,
        result: state.result,
        turn: state.turn,
        self: player,
        enemy,
        ships: state.ships[player.id] ?? [],
        myBoard: state.boards[player.id] ?? [],
        enemyBoard: (
          state.boards[enemy.id] ?? ([] as TBoard<ECellStatus | number>)
        ).map((row) => {
          return row.map((cell) => {
            // allow all but ECellStatus.Ship
            if (typeof cell === "number" || cell === ECellStatus.Ship) {
              return ECellStatus.Empty;
            }
            return cell;
          });
        }),
        enemyDestroyedShips: enemyShips.filter(isSunk),
      };
    }
  }
}
