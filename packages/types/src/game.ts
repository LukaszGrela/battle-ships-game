import {
  EGamePhase,
  TCellStatus,
  TCellStatusMiss,
  TCellStatusShipDestroyed,
  TCellStatusShipHit,
  TCellStatusShipId,
  TCoordinate,
  TShipPlacementOrientation,
} from "./game-logic";
import { TStringifiedEnum } from "./utils";

type TRoomId = string;

type TUserId = string;

export interface IPlayer {
  /**
   * Unique identifier of the player
   */
  id: string;
  /**
   * Name of the player
   */
  name: string;
  /**
   * Random seed value
   */
  seed: number;
  /**
   * Activity status
   */
  active: boolean;
  /**
   * Player is ready to play (ships placed)
   */
  ready: boolean;
  /**
   * Owner of the war room, this user created the game.
   */
  owner?: boolean;
}

export type TBoard<S = TCellStatus> = S[][];

type TPlacedShipProps = {
  coords: TCoordinate;
  orientation: TShipPlacementOrientation;
  hits: TCoordinate[];
  type: "placed";
};

export type TShip = {
  // TODO: TCellStatusShip
  id: number;
  size: number;
} & (
  | TPlacedShipProps
  | {
      type: "pending";
      placed: boolean;
      coords?: TCoordinate;
      orientation?: TShipPlacementOrientation;
    }
);

export type TPlacedShip = TShip & { type: "placed" };

type TInitHistory = {
  init: true;
};

type TFinishHistory = {
  finish: true;
  whoWon: string;
  byForfeit?: boolean;
};

export type TAttackHistory = {
  turn: TUserId;
  coords: TCoordinate;
  result: TCellStatusMiss | TCellStatusShipHit | TCellStatusShipDestroyed;
  isSunk: boolean;
  size: number;
};

export type THistoryEntry = TAttackHistory | TInitHistory | TFinishHistory;
export type TGameTimeStamps = {
  game_created: string | null;
  game_started: string | null;
  game_finished: string | null;
};
export type TRoomIdentity = {
  id: TRoomId;
  name: string;

  phase: TStringifiedEnum<EGamePhase>;
} & TGameTimeStamps;
export type TRematchRequest = {
  requestorId: TUserId;

  name: string;
  seed: number;

  status: "pending" | "accepted" | "rejected";
};

export type TRoomState = TRoomIdentity & {
  players: Record<TUserId, IPlayer>;
  boards: Record<TUserId, TBoard>;
  ships: Record<TUserId, TShip[]>;

  turn: TUserId;
  phase: TStringifiedEnum<EGamePhase>;
  result: Record<TUserId, "win" | "lost">;
  /**
   * Previous battles, if the opponent requested rematch.
   * Cuttent `TRoomState` is the recent battle, and `battles` is the history of previous battles.
   */
  battles: TRoomState[];

  history: THistoryEntry[];
  rematchRequest?: TRematchRequest;
};

export type TGameState = Omit<
  TRoomState,
  "boards" | "history" | "players" | "phase" | "ships" | "battles"
> & {
  myBoard: TBoard<TCellStatus>;
  self: IPlayer;
} & (
    | {
        phase: TStringifiedEnum<EGamePhase.Waiting> & {};
      }
    | {
        phase: TStringifiedEnum<EGamePhase.Placement> & {};
        ships: TShip[];
        enemy: IPlayer;

        battleResults?: Record<TUserId, number>;
      }
    | {
        ships: TShip[];
        phase: TStringifiedEnum<
          Exclude<
            EGamePhase,
            EGamePhase.Waiting | EGamePhase.Placement | EGamePhase.Finished
          >
        > & {};
        enemy: IPlayer;
        enemyBoard: TBoard<Exclude<TCellStatus, TCellStatusShipId>>;
        enemyDestroyedShips: TShip[];
        /**
         * Enemy attack result.
         */
        lastAttack?: TAttackHistory;

        battleResults?: Record<TUserId, number>;
      }
    | {
        ships: TShip[];
        phase: TStringifiedEnum<EGamePhase.Finished> & {};
        enemy: IPlayer;
        enemyBoard: TBoard<TCellStatus>;
        enemyDestroyedShips: TShip[];
        rematchRequest?: TRematchRequest;

        battleResults?: Record<TUserId, number>;
      }
  );

export type TStats = {
  activeGames: number;
  playedGames: number;
  activePlayers: number;
};

export type TAttackResult =
  | {
      ok: true;
      status: TCellStatusShipDestroyed;
      size: number;
    }
  | {
      ok: true;
      status: TCellStatusShipHit | TCellStatusMiss;
    }
  | { ok: false; message: string };
