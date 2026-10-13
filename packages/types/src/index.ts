export type TCoordinate = { x: number; y: number };

export enum ECellStatus {
  Margin = "margin",
  Empty = "empty",
  Ship = "ship",
  Hit = "hit",
  Miss = "miss",
  Destroyed = "destroyed",
}

export enum EGamePhase {
  Waiting = "waiting",
  Placement = "placement",
  Playing = "playing",
  Finished = "finished",
}

type TRoomId = string;

type TUserId = string;

export interface IPlayer {
  id: string;
  name: string;
  active: boolean;
  ready: boolean;
  seed: number;
  /**
   * Owner of the war room, this user created the game.
   */
  owner?: boolean;
}

export type TBoard<S = ECellStatus> = S[][];

export type TShipPlacementOrientation = "horizontal" | "vertical";

type TPlacedShipProps = {
  coords: TCoordinate;
  orientation: TShipPlacementOrientation;
  hits: TCoordinate[];
  type: "placed";
};

export type TShip = {
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
};

export type TAttackHistory = {
  turn: TUserId;
  coords: TCoordinate;
  result: ECellStatus.Hit | ECellStatus.Miss;
  isSunk: boolean;
  size: number;
};

export type THistoryEntry = TAttackHistory | TInitHistory | TFinishHistory;

export type TRoomIdentity = {
  id: TRoomId;
  name: string;
  game_created: string;
  game_started: string | null;
  game_finished: string | null;

  phase: TStringifiedEnum<EGamePhase>;
};
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

type TStringifiedEnum<E extends string> = E | `${E}`;

export type TGameState = Omit<
  TRoomState,
  "boards" | "history" | "players" | "phase" | "ships"
> & {
  myBoard: TBoard;
  self: IPlayer;
} & (
    | {
        phase: TStringifiedEnum<EGamePhase.Waiting> & {};
      }
    | {
        phase: TStringifiedEnum<EGamePhase.Placement> & {};
        ships: TShip[];
        enemy: IPlayer;
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
        enemyBoard: TBoard<Exclude<ECellStatus, ECellStatus.Ship>>;
        enemyDestroyedShips: TShip[];
        /**
         * Enemy attack result.
         */
        lastAttack?: TAttackHistory;
      }
    | {
        ships: TShip[];
        phase: TStringifiedEnum<EGamePhase.Finished> & {};
        enemy: IPlayer;
        enemyBoard: TBoard;
        enemyDestroyedShips: TShip[];
        rematchRequest?: TRematchRequest;
      }
  );

export interface IClientToServerEvents {
  /**
   * When custom name is given (a string) then new game is created. When `TRoomIdentity` is given then it is joining existing game.
   * @param roomId Custom name or existing game identifier.
   */
  join_game: (roomId: string | Pick<TRoomIdentity, "id" | "name">) => void;
  leave_game: () => void;

  place_ships: (ships: (TShip & { type: "pending" })[]) => void;

  attack_coordinate: (
    coord: TCoordinate,
    callback: (result: TAttackResult) => void,
  ) => void;
  request_rematch: () => void;
  accept_rematch: () => void;
  reject_rematch: () => void;
  /**
   * Get new random war room game (name=null), or propose custom war room game name (name!=null).
   * If proposed name already exists callback returns new proposition, if custom name is unique the same name is returned.
   * @param callback
   * @returns
   */
  get_war_room_name: (
    proposition: string | null,
    callback: (name: string | null) => void,
  ) => void;

  get_rooms: (callback: (rooms: TRoomIdentity[]) => void) => void;

  /**
   * User intentionally want's to disconnect. It means abandoning any running games.
   */
  disconnect_from_server: () => void;

  get_stats: (callback: (stats: TStats) => void) => void;
}

export interface IServerToClientEvents {
  game_updated: (state: TGameState | null) => void;
  error: (msg: string) => void;
  /**
   * Success Event dispatched in response to `join_game` with assigned user id.
   * @param userId
   * @returns
   */
  welcome: (userId: string) => void;

  /**
   * Event sent on connection to the game.
   * Lists open games that awaits opponents.
   */
  open_games: (roomNames: TRoomIdentity[]) => void;

  /**
   * Emited when user has finished placing his ships and is ready to battle.
   * @param playerName
   * @returns
   */
  player_ready: (
    playerName: Pick<IPlayer, "name" | "seed" | "owner" | "ready">,
  ) => void;

  /**
   * Emited when user entered war room and `waiting` is finished.
   * @param opponent
   * @returns
   */
  opponent_connected: (
    opponent: Pick<IPlayer, "name" | "seed" | "owner" | "ready">,
  ) => void;

  /**
   *
   * @param callback
   * @returns
   */
  server_stats: (stats: TStats) => void;

  rematch_requested: (payload: TRematchRequest) => void;
  rematch_accepted: (payload: { roomId: string; status: "accepted" }) => void;
  rematch_rejected: (payload: {
    roomId: string;
    requestorId: string;
    status: "rejected";
  }) => void;
  /**
   * Emited when known user connects and session object exists
   * @param session client session object
   * @returns
   */
  session_restored: (session: IClientSession) => void;
  /**
   * Emited when new user connects or session object does not exists
   * @param newSession client session object
   * @returns
   */
  session_created: (newSession: IClientSession) => void;
}

export type TStats = {
  activeGames: number;
  playedGames: number;
  activePlayers: number;
};

export interface IClientSession {
  /**
   * Client ID
   */
  id: string;
  /**
   * Current socket id
   */
  socketId: string;

  /**
   * Current active game id
   */
  gameId?: string;

  /**
   * Timestamp when the client disconnected from the active room.
   * Cleared on reconnect so reconnect grace can be resumed.
   */
  disconnectedAt?: number;

  name: string;
  seed: number;
}

export type TAttackResult =
  | {
      ok: true;
      status: ECellStatus.Destroyed;
      size: number;
    }
  | {
      ok: true;
      status: ECellStatus.Hit | ECellStatus.Miss;
    }
  | { ok: false; message: string };
// -----
/**
 * Makes partial selected as `K` fields.
 * Note: rest is not changed
 */
export type TPartialPick<T, K extends keyof T> = Partial<Pick<T, K>> &
  Omit<T, K>;

export type TDataProps = {
  [key: `data-${string}`]: string | boolean | number | undefined;
};
