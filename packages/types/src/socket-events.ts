import {
  TRoomIdentity,
  TShip,
  TAttackResult,
  TStats,
  TGameState,
  IPlayer,
  TRematchRequest,
} from "./game";
import { TCoordinate, IClientSession } from "./game-logic";

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
    playerName: Pick<IPlayer, "id" | "name" | "seed" | "owner" | "ready">,
  ) => void;
  player_left: (playerName?: Pick<IPlayer, "id" | "name" | "seed">) => void;

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
  session_token: (token: string) => void;
}
