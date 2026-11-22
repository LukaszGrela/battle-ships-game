import type { IClientSession } from "@repo/types";
import type { IFinishedGameRecord } from "../game-stats.service";

/** One room, already serialized by `WarRoom.serialize()`. */
export interface IRoomSnapshot {
  id: string;
  name: string;
  phase: string;
  data: string;
}

/** The mutable part of the server that a restart has to bring back. */
export interface IStateSnapshot {
  rooms: IRoomSnapshot[];
  sessions: IClientSession[];
  roomNames: string[];
  gameStats: IFinishedGameRecord[];
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
  /** Present when nothing was restored (`no-snapshot`, `corrupt`, ...). */
  reason?: string;
}
