/**
 * Game statistics store.
 *
 * This is the single place where finished battles are remembered. It is
 * intentionally **not** derived from `ActiveGameRegistry`: rooms are deleted
 * (leave / forfeit / finished-room TTL) and everything computed from them
 * disappears with the room, which is fine for "what is happening now" counters
 * (`activeGames`) but wrong for lifetime numbers such as `playedGames`.
 *
 * The store is append-only and event-shaped, so it can grow with more data
 * later (rounds, duration, bot difficulty, sunk ships, Elo...) without
 * touching the recording call sites:
 *
 *  - one `IFinishedGameRecord` per finished battle,
 *  - `players[]` describes the outcome from every participant's perspective,
 *  - `meta` is a free-form bag for future fields.
 *
 * Swapping the in-memory implementation for a database later means
 * implementing `IGameStatsService` and keeping the same singleton.
 */

import { TBotDifficulty } from "@repo/types";

/** Result of a single finished battle, as seen by one participant. */
export interface IFinishedGamePlayer {
  id: string;
  name: string;
  /** Bot players never get their own aggregate row (ids are per room). */
  botLevel?: TBotDifficulty;
  result: "win" | "lost";
}

/** One finished battle. Extend through `meta`, do not reorder fields. */
export interface IFinishedGameRecord {
  /** Stable identity of the battle: `${roomId}#${battleIndex}`. */
  id: string;
  roomId: string;
  roomName: string;
  /** 0-based index of the battle inside the room (rematches increment it). */
  battleIndex: number;
  /** ISO timestamp taken from the game itself when available. */
  finishedAt: string;
  byForfeit: boolean;
  players: IFinishedGamePlayer[];
  /** Extension point for additional game data. */
  meta: Record<string, unknown>;
}

/** Aggregated per-player numbers derived from the records above. */
export interface IPlayerGameStats {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winsByForfeit: number;
  lossesByForfeit: number;
  lastPlayedAt: string | null;
}

export interface IRecordGameResult {
  /** `true` when the record was stored, `false` for a duplicate. */
  recorded: boolean;
  record: IFinishedGameRecord;
}

export interface IGameStatsService {
  /** Idempotent: the same `record.id` is stored at most once. */
  recordGame(record: IFinishedGameRecord): IRecordGameResult;
  hasGame(id: string): boolean;
  /** Lifetime number of finished battles – feeds `TStats.playedGames`. */
  playedGames(): number;
  playedGamesByForfeit(): number;
  recentGames(limit?: number): readonly IFinishedGameRecord[];
  /** Every stored record, insertion order. Used by the state snapshot. */
  allGames(): readonly IFinishedGameRecord[];
  getGame(id: string): IFinishedGameRecord | undefined;
  playerStats(playerId: string): IPlayerGameStats | undefined;
  allPlayerStats(): IPlayerGameStats[];
  get size(): number;
  /** Tests / server restart helpers only. */
  reset(): void;
}

const buildRecordId = (roomId: string, battleIndex: number): string =>
  `${roomId}#${battleIndex}`;

export class GameStatsService implements IGameStatsService {
  readonly #games = new Map<string, IFinishedGameRecord>();
  readonly #playerStats = new Map<string, IPlayerGameStats>();

  recordGame(record: IFinishedGameRecord): IRecordGameResult {
    const existing = this.#games.get(record.id);
    if (existing) {
      return { recorded: false, record: existing };
    }

    this.#games.set(record.id, record);

    if (record.players.length > 0) {
      for (const player of record.players) {
        if (player.botLevel) continue;
        this.#accumulatePlayerStats(player, record);
      }
    }

    return { recorded: true, record };
  }

  hasGame(id: string): boolean {
    return this.#games.has(id);
  }

  playedGames(): number {
    return this.#games.size;
  }

  playedGamesByForfeit(): number {
    return Array.from(this.#games.values()).filter((game) => game.byForfeit)
      .length;
  }

  recentGames(limit = 20): readonly IFinishedGameRecord[] {
    return Array.from(this.#games.values())
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
      .slice(0, Math.max(0, limit));
  }

  allGames(): readonly IFinishedGameRecord[] {
    return Array.from(this.#games.values());
  }

  getGame(id: string): IFinishedGameRecord | undefined {
    return this.#games.get(id);
  }

  playerStats(playerId: string): IPlayerGameStats | undefined {
    const stats = this.#playerStats.get(playerId);
    return stats ? { ...stats } : undefined;
  }

  allPlayerStats(): IPlayerGameStats[] {
    return Array.from(this.#playerStats.values())
      .map((stats) => ({ ...stats }))
      .sort((a, b) => b.wins - a.wins || b.played - a.played);
  }

  get size(): number {
    return this.#games.size;
  }

  reset(): void {
    this.#games.clear();
    this.#playerStats.clear();
  }

  #accumulatePlayerStats(
    player: IFinishedGamePlayer,
    record: IFinishedGameRecord,
  ): void {
    const current =
      this.#playerStats.get(player.id) ??
      ({
        playerId: player.id,
        name: player.name,
        played: 0,
        wins: 0,
        losses: 0,
        winsByForfeit: 0,
        lossesByForfeit: 0,
        lastPlayedAt: null,
      } satisfies IPlayerGameStats);

    current.name = player.name || current.name;
    current.played += 1;
    if (player.result === "win") {
      current.wins += 1;
      if (record.byForfeit) current.winsByForfeit += 1;
    } else {
      current.losses += 1;
      if (record.byForfeit) current.lossesByForfeit += 1;
    }

    if (!current.lastPlayedAt || record.finishedAt > current.lastPlayedAt) {
      current.lastPlayedAt = record.finishedAt;
    }

    this.#playerStats.set(player.id, current);
  }
}

export { buildRecordId };

/**
 * Singleton wrapper around `GameStatsService` – mirrors
 * `ActiveGameRegistrySingleton` so handlers import one stable entry point.
 */
class GameStatsServiceSingleton {
  static #instance?: IGameStatsService;

  public static getInstance(): IGameStatsService {
    if (!GameStatsServiceSingleton.#instance) {
      GameStatsServiceSingleton.#instance = new GameStatsService();
    }

    return GameStatsServiceSingleton.#instance;
  }
}

export default GameStatsServiceSingleton;
