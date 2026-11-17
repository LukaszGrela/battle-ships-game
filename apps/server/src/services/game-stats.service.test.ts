import { beforeEach, describe, expect, it } from "vitest";
import {
  GameStatsService,
  buildRecordId,
  type IFinishedGameRecord,
} from "./game-stats.service";

const record = (
  overrides: Partial<IFinishedGameRecord> = {},
): IFinishedGameRecord => ({
  id: buildRecordId("room-1", 0),
  roomId: "room-1",
  roomName: "Room 1",
  battleIndex: 0,
  finishedAt: "2026-01-01T10:00:00.000Z",
  byForfeit: false,
  players: [
    { id: "p1", name: "Alice", isBot: false, result: "win" },
    { id: "p2", name: "Bob", isBot: false, result: "lost" },
  ],
  meta: {},
  ...overrides,
});

describe("GameStatsService", () => {
  let stats: GameStatsService;

  beforeEach(() => {
    stats = new GameStatsService();
  });

  it("counts finished games independently of any room registry", () => {
    expect(stats.playedGames()).toBe(0);

    stats.recordGame(record());

    expect(stats.playedGames()).toBe(1);
    expect(stats.size).toBe(1);
  });

  it("stores a battle only once", () => {
    const first = stats.recordGame(record());
    const second = stats.recordGame(record({ roomName: "Changed" }));

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(second.record.roomName).toBe("Room 1");
    expect(stats.playedGames()).toBe(1);
  });

  it("counts every rematch as a separate game", () => {
    stats.recordGame(record());
    stats.recordGame(
      record({
        id: buildRecordId("room-1", 1),
        battleIndex: 1,
        finishedAt: "2026-01-01T10:05:00.000Z",
      }),
    );

    expect(stats.playedGames()).toBe(2);
    expect(stats.playerStats("p1")).toMatchObject({ played: 2, wins: 2 });
  });

  it("aggregates wins and losses per player", () => {
    stats.recordGame(record());
    stats.recordGame(
      record({
        id: buildRecordId("room-1", 1),
        battleIndex: 1,
        players: [
          { id: "p1", name: "Alice", isBot: false, result: "lost" },
          { id: "p2", name: "Bob", isBot: false, result: "win" },
        ],
      }),
    );

    expect(stats.playerStats("p1")).toMatchObject({
      playerId: "p1",
      name: "Alice",
      played: 2,
      wins: 1,
      losses: 1,
    });
    expect(stats.playerStats("p2")).toMatchObject({
      played: 2,
      wins: 1,
      losses: 1,
    });
  });

  it("counts forfeits without hiding them in the totals", () => {
    stats.recordGame(
      record({
        byForfeit: true,
        players: [
          { id: "p1", name: "Alice", isBot: false, result: "win" },
          { id: "p2", name: "Bob", isBot: false, result: "lost" },
        ],
      }),
    );

    expect(stats.playedGamesByForfeit()).toBe(1);
    expect(stats.playerStats("p1")).toMatchObject({
      wins: 1,
      winsByForfeit: 1,
    });
    expect(stats.playerStats("p2")).toMatchObject({
      losses: 1,
      lossesByForfeit: 1,
    });
  });

  it("keeps bot players out of the per-player leaderboard", () => {
    stats.recordGame(
      record({
        players: [
          { id: "p1", name: "Alice", isBot: false, result: "lost" },
          { id: "bot-abc", name: "Bot", isBot: true, result: "win" },
        ],
      }),
    );

    expect(stats.playedGames()).toBe(1);
    expect(stats.playerStats("bot-abc")).toBeUndefined();
    expect(stats.allPlayerStats()).toHaveLength(1);
    expect(stats.playerStats("p1")).toMatchObject({ losses: 1, wins: 0 });
  });

  it("returns the newest games first and respects the limit", () => {
    stats.recordGame(record({ finishedAt: "2026-01-01T10:00:00.000Z" }));
    stats.recordGame(
      record({
        id: buildRecordId("room-2", 0),
        roomId: "room-2",
        finishedAt: "2026-01-02T10:00:00.000Z",
      }),
    );

    expect(stats.recentGames(1).map((game) => game.roomId)).toEqual(["room-2"]);
    expect(stats.recentGames().map((game) => game.roomId)).toEqual([
      "room-2",
      "room-1",
    ]);
  });

  it("exposes a copy so callers cannot mutate stored aggregates", () => {
    stats.recordGame(record());
    const first = stats.playerStats("p1");
    if (!first) throw new Error("missing stats");

    first.wins = 99;

    expect(stats.playerStats("p1")?.wins).toBe(1);
  });
});
