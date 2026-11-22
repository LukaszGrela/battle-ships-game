import { afterEach, describe, expect, it, vi } from "vitest";
import type { IPlayer, TCellStatusShipId, TCoordinate, TShip } from "@repo/types";
import { WarRoom } from "../services/WarRoom";
import { BotPlayer, type IBotPlayerSnapshot } from "./BotPlayer";
import { BotRunner, DEFAULT_BOTS_CONFIG, BOT_ID_PREFIX } from "./BotRunner";
import { ProbabilityBrain } from "./ProbabilityBrain";
import { Mulberry32 } from "./random";
import type { IBotBrainSnapshot, TAttackOutcome } from "./types";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const HUMAN_ID = "human";

const createHuman = (): IPlayer => ({
  id: HUMAN_ID,
  name: "Captain Human",
  active: true,
  ready: false,
  owner: true,
  seed: 42,
});

const createFleet = (): (TShip & {
  type: "pending";
  id: TCellStatusShipId;
})[] =>
  [5, 4, 3, 3, 2].map((size, index) => ({
    id: (index + 1) as TCellStatusShipId,
    size,
    type: "pending" as const,
    placed: true as const,
    coords: { x: 0, y: index * 2 },
    orientation: "horizontal" as const,
  }));

const fleetSpecs = () =>
  createFleet().map((ship) => ({ id: ship.id as number, size: ship.size }));

const runners: BotRunner[] = [];
const players: BotPlayer[] = [];

afterEach(() => {
  for (const runner of runners.splice(0)) runner.disposeAll();
  for (const player of players.splice(0)) player.dispose();
  vi.useRealTimers();
});

const collect = (count: number, next: () => TCoordinate): TCoordinate[] =>
  Array.from({ length: count }, () => next());

/* ------------------------------------------------------------------ */
/* PRNG                                                                */
/* ------------------------------------------------------------------ */

describe("Mulberry32 state", () => {
  it("resumes the exact same stream from a saved cursor", () => {
    const original = new Mulberry32(7);
    original.next();
    original.next();

    const saved = original.state;
    const resumed = Mulberry32.from(saved);

    expect(resumed.seed).toBe(original.seed);
    expect(collect(5, () => ({ x: original.next(), y: 0 }))).toEqual(
      collect(5, () => ({ x: resumed.next(), y: 0 })),
    );
  });

  it("rejects a corrupt cursor", () => {
    expect(() => Mulberry32.from({ seed: 1, cursor: -1 })).toThrow(
      /PRNG state: cursor/,
    );
    expect(() => Mulberry32.from({ seed: 1.5, cursor: 0 })).toThrow(
      /PRNG seed/,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Brain                                                               */
/* ------------------------------------------------------------------ */

describe("ProbabilityBrain serialization", () => {
  const build = (): ProbabilityBrain => {
    const brain = new ProbabilityBrain({ size: 10, seed: 99, blunderChance: 0 });
    brain.setFleet(fleetSpecs());
    brain.report({ x: 0, y: 0 }, 101 as TAttackOutcome);
    brain.report({ x: 1, y: 0 }, 0 as TAttackOutcome);
    brain.report({ x: 2, y: 0 }, 102 as TAttackOutcome);
    return brain;
  };

  it("restores the learned board and continues the same shots", () => {
    const original = build();
    const snapshot = original.serialize();

    expect(snapshot.kind).toBe("probability");
    expect(snapshot.version).toBe(1);
    // grid is a compact base64 string, not a JSON array of 100 numbers
    expect(typeof (snapshot.state as { grid: unknown }).grid).toBe("string");

    const restored = new ProbabilityBrain({
      size: 10,
      seed: 1, // deliberately different: the snapshot wins
      blunderChance: 0.9,
    });
    restored.deserialize(snapshot);

    expect(collect(8, () => original.nextShot())).toEqual(
      collect(8, () => restored.nextShot()),
    );
    // the restored blunder rate is the one the bot played with, not the default
    expect(restored.serialize().state).toEqual(
      original.serialize().state,
    );
  });

  it("rejects a snapshot from another brain kind", () => {
    const restored = new ProbabilityBrain({ size: 10, seed: 1 });
    expect(() =>
      restored.deserialize({
        kind: "oracle",
        version: 1,
        state: {},
      } as IBotBrainSnapshot),
    ).toThrow(/brain.kind/);
  });

  it("rejects a truncated grid", () => {
    const restored = new ProbabilityBrain({ size: 10, seed: 1 });
    const snapshot = build().serialize();
    const state = snapshot.state as Record<string, unknown>;

    expect(() =>
      restored.deserialize({
        ...snapshot,
        state: { ...state, grid: Buffer.from([0, 1, 2]).toString("base64") },
      }),
    ).toThrow(/brain.state.grid/);
  });
});

/* ------------------------------------------------------------------ */
/* BotPlayer                                                           */
/* ------------------------------------------------------------------ */

const createBot = (room: WarRoom, seed = 4242): BotPlayer => {
  const bot = new BotPlayer(
    room,
    `${BOT_ID_PREFIX}1`,
    new ProbabilityBrain({ size: 10, seed, blunderChance: 0 }),
    { minDelayMs: 10, maxDelayMs: 20, autoAcceptRematch: false },
    seed,
  );
  players.push(bot);
  return bot;
};

describe("BotPlayer serialization", () => {
  it("round-trips its own state together with the brain", () => {
    vi.useFakeTimers();
    const room = new WarRoom("room-1", "Serialization", createHuman());
    const bot = createBot(room, 4242);

    const snapshot = bot.serialize();

    expect(snapshot.id).toBe(`${BOT_ID_PREFIX}1`);
    expect(snapshot.seed).toBe(4242);
    expect(snapshot.brain.kind).toBe("probability");
    expect(snapshot.options).toEqual({
      minDelayMs: 10,
      maxDelayMs: 20,
      autoAcceptRematch: false,
    });
    // timers and callbacks must never leak into the snapshot
    expect(JSON.stringify(snapshot)).not.toContain("function");

    const restored = createBot(room, 4242);
    restored.deserialize(snapshot);

    expect(restored.serialize()).toEqual(snapshot);
  });

  it("rejects a snapshot addressed to another player", () => {
    vi.useFakeTimers();
    const room = new WarRoom("room-2", "Serialization", createHuman());
    const bot = createBot(room);
    const snapshot: IBotPlayerSnapshot = {
      ...bot.serialize(),
      id: `${BOT_ID_PREFIX}other`,
    };

    expect(() => createBot(room).deserialize(snapshot)).toThrow(/bot.id/);
  });
});

/* ------------------------------------------------------------------ */
/* BotRunner.restoreBot                                                */
/* ------------------------------------------------------------------ */

describe("BotRunner.restoreBot", () => {
  it("re-attaches the driver without duplicating the bot player", () => {
    vi.useFakeTimers();
    const room = new WarRoom("room-restore", "Restored", createHuman());

    let liveRoom: WarRoom | undefined = room;
    const runner = new BotRunner(
      (id) => (liveRoom && id === liveRoom.id ? liveRoom : undefined),
      { ...DEFAULT_BOTS_CONFIG, difficulty: "medium" },
    );
    runners.push(runner);

    const bot = runner.spawnBot(room.id, "medium");
    expect(bot).toBeDefined();
    expect(room.getPlayers()).toHaveLength(2);

    const [record] = runner.serializeBots();
    expect(record.roomId).toBe(room.id);

    // Simulate the restart: a fresh room rebuilt from its own snapshot, then a
    // fresh runner with no bots yet.
    const restoredRoom = WarRoom.deserialize(room.serialize());
    expect(restoredRoom.getPlayers()).toHaveLength(2);
    const botPlayersBefore = restoredRoom.getPlayers().length;

    liveRoom = restoredRoom;
    const restoredRunner = new BotRunner(
      (id) => (id === restoredRoom.id ? restoredRoom : undefined),
      { ...DEFAULT_BOTS_CONFIG, difficulty: "medium" },
    );
    runners.push(restoredRunner);

    const restoredBot = restoredRunner.restoreBot(restoredRoom.id, record.bot);

    expect(restoredBot?.id).toBe(record.bot.id);
    expect(restoredRoom.getPlayers()).toHaveLength(botPlayersBefore);
    expect(restoredRunner.getBotId(restoredRoom.id)).toBe(record.bot.id);
    expect(restoredRunner.serializeBots()[0].bot).toEqual(record.bot);
  });

  it("returns undefined when the room or its bot player is gone", () => {
    vi.useFakeTimers();
    const room = new WarRoom("room-gone", "Gone", createHuman());
    const runner = new BotRunner(
      (id) => (id === room.id ? room : undefined),
      { ...DEFAULT_BOTS_CONFIG, difficulty: "easy" },
    );
    runners.push(runner);

    runner.spawnBot(room.id, "easy");
    // `spawnBot()` returns the room player; the snapshot lives on the driver.
    const snapshot = runner.serializeBots()[0].bot;

    expect(runner.restoreBot("unknown-room", snapshot)).toBeUndefined();

    room.removePlayer(snapshot.id);
    const emptied = runner.serializeBots();
    expect(emptied).toHaveLength(1); // driver still alive, player is not
    expect(
      runner.restoreBot(room.id, { ...snapshot, id: `${BOT_ID_PREFIX}ghost` }),
    ).toBeUndefined();
  });
});
