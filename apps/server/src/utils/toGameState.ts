import {
  ECellStatus,
  EGamePhase,
  TAttackHistory,
  TBoard,
  TGameState,
  TRoomState,
} from "@repo/types";
import { getPlayerById } from "./getPlayerById";
import { getOtherPlayer } from "./getOtherPlayer";
import { isSunk } from "@repo/game-logic";

export function toGameState(
  playerId: string,
  state: TRoomState,
): TGameState | null {
  // console.log("toGameState", playerId, state.id, state.name);
  const player = getPlayerById(playerId, state.players);

  if (!player) return null;
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

      battleResults: state.battles.reduce(
        (acc, battle) => {
          Object.entries(battle.result).forEach(([playerId, result]) => {
            acc[playerId] = (acc[playerId] ?? 0) + (result === "win" ? 1 : 0);
          });

          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  } else {
    const enemy = getOtherPlayer(playerId, state.players)!;
    const enemyShips = state.ships[enemy.id] ?? [];
    if (state.phase === "finished") {
      const battleResults = state.battles.reduce(
        (acc, battle) => {
          Object.entries(battle.result).forEach(([playerId, result]) => {
            acc[playerId] = (acc[playerId] ?? 0) + (result === "win" ? 1 : 0);
          });

          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(state.result).forEach(([playerId, result]) => {
        battleResults[playerId] =
          (battleResults[playerId] ?? 0) + (result === "win" ? 1 : 0);
      });

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
        rematchRequest: state.rematchRequest,

        battleResults,
      };
    } else {
      const lastAttack = state.history.at(-1) as TAttackHistory | undefined;

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
        lastAttack:
          lastAttack && state.turn === player.id ? lastAttack : undefined,

        battleResults: state.battles.reduce(
          (acc, battle) => {
            Object.entries(battle.result).forEach(([playerId, result]) => {
              acc[playerId] = (acc[playerId] ?? 0) + (result === "win" ? 1 : 0);
            });

            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    }
  }
}
