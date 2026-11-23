import type { IClientSession } from "@repo/types";
import type { IBotPlayerSnapshot } from "../../bots/BotPlayer";
import type { IFinishedGameRecord } from "../game-stats.service";

/** One room, already serialized by `WarRoom.serialize()`. */
export interface IRoomSnapshot {
  id: string;
  name: string;
  phase: string;
  data: string;
}

/**
 * Live bot of a room. The bot's `IPlayer` already travels inside the room
 * snapshot – this record only restores the driver (brain + scheduler).
 */
export interface IBotStateRecord {
  roomId: string;
  bot: IBotPlayerSnapshot;
}

/** The mutable part of the server that a restart has to bring back. */
export interface IStateSnapshot {
  rooms: IRoomSnapshot[];
  sessions: IClientSession[];
  roomNames: string[];
  gameStats: IFinishedGameRecord[];
  /**
   * Optional: snapshots written before stage 2 have no bot data at all, and a
   * room whose bot cannot be resumed is closed by the restore flow.
   */
  bots?: IBotStateRecord[];
}

/** On-disk wrapper: metadata + checksum + payload. */
export interface IStateEnvelope {
  version: number;
  savedAt: string;
  checksum: string;
  state: IStateSnapshot;
}

export type TStateLoadResult =
  | { status: "missing" }
  | { status: "ok"; savedAt: string; state: IStateSnapshot }
  | { status: "corrupt"; reason: string; quarantinedPath?: string };

export interface IStateSaveResult {
  savedAt: string;
  bytes: number;
  rooms: number;
  sessions: number;
  gameStats: number;
  bots: number;
}

export interface IRestoredRoomInfo {
  id: string;
  name: string;
  phase: string;
  rematchReset: boolean;
}

export interface IClosedRoomInfo {
  id: string;
  name: string;
  reason: string;
}

export interface IRestoreReport {
  restored: boolean;
  savedAt?: string;
  rooms: IRestoredRoomInfo[];
  closedRooms: IClosedRoomInfo[];
  sessions: number;
  gameStats: number;
  /** Live bot drivers re-attached to restored rooms. */
  bots: number;
  /** Present when nothing was restored (`no-snapshot`, `corrupt`, ...). */
  reason?: string;
}
