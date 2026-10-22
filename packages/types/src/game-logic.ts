export type TCoordinate = { x: number; y: number };
export type TShipPlacementOrientation = "horizontal" | "vertical";

export enum EGamePhase {
  Waiting = "waiting",
  Placement = "placement",
  Playing = "playing",
  Finished = "finished",
}

export type TPlacementValidationErrors = -1001 | -1002 | -1003;

// When margin is needed this cell status can be used
export type TCellStatusMargin = -2;
export type TCellStatusEmpty = -1;
export type TCellStatusMiss = 0;

// Ship identifier, <1..10>
export type TCellStatusShipId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Ship hit (ship id + 100), <101..110>
export type TCellStatusShipHitOffset = 100;
export type TCellStatusShipHit =
  101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110;

// To indicate destroyed ship this cell status can be used, Ship id + 1000, <1001..1010>
export type TCellStatusShipDestroyedOffset = 1000;
export type TCellStatusShipDestroyed =
  1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007 | 1008 | 1009 | 1010;
export type TCellStatus =
  | TCellStatusMargin
  | TCellStatusEmpty
  | TCellStatusMiss
  | TCellStatusShipId
  | TCellStatusShipHit
  | TCellStatusShipDestroyed;

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
