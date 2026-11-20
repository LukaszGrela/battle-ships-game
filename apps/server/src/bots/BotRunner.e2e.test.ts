import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EGamePhase,
  TGameState,
  type IPlayer,
  type TCellStatusShipId,
  type TCoordinate,
  type TShip,
} from "@repo/types";
import { WarRoom } from "../services/WarRoom";
import {
  BOT_ID_PREFIX,
  BotRunner,
  DEFAULT_BOTS_CONFIG,
  isBotPlayerId,
} from "./BotRunner";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const HUMAN_ID = "human";

const key = ({ x, y }: TCoordinate) => `${x},${y}`;

const createHuman = (): IPlayer => ({
  id: HUMAN_ID,
  name: "Captain Human",
  active: true,
  ready: false,
  owner: true,
  seed: 42,
});

/**
 * Same fleet layout the other room tests use: every ship on its own row,
 * starting at x = 0, so placement is always legal.
 */
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

const allCells = (): TCoordinate[] => {
  const cells: TCoordinate[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) cells.push({ x, y });
  }
  return cells;
};

/* ------------------------------------------------------------------ */
/* Harness – real WarRoom + real BotRunner, no mocked game rules        */
/* ------------------------------------------------------------------ */

interface IAttackSpy {
  mock: {
    calls: Array<[string, TCoordinate]>;
    results: Array<{ value: unknown }>;
  };
}

interface IHarness {
  room: WarRoom;
  runner: BotRunner;
  /** Room ids passed to the `onBotAction` hook. */
  actions: string[];
  /** Every `WarRoom.attack()` call, including the bot's. */
  attackSpy: IAttackSpy;
  /** Toggle the app-layer broadcast wiring mid-test. */
  setBroadcast: (enabled: boolean) => void;
}

const runners: BotRunner[] = [];

const setup = (
  roomId: string,
  { broadcast = true }: { broadcast?: boolean } = {},
): IHarness => {
  const room = new WarRoom(roomId, "Automatic opponent E2E", createHuman());
  const actions: string[] = [];
  const attackSpy = vi.spyOn(room, "attack");

  let broadcastEnabled = broadcast;
  let runner!: BotRunner;
  runner = new BotRunner(
    (id) => (id === room.id ? room : undefined),
    { ...DEFAULT_BOTS_CONFIG, difficulty: "hard" },
    {
      onBotAction: (id) => {
        actions.push(id);
        // This mirrors the production wiring: every bot action is broadcast.
        if (broadcastEnabled) runner.onRoomStateChanged(id);
      },
    },
  );
  runners.push(runner);

  return {
    room,
    runner,
    actions,
    attackSpy,
    setBroadcast: (enabled: boolean) => {
      broadcastEnabled = enabled;
    },
  };
};

interface ILegalAttack {
  player: string;
  coord: TCoordinate;
  result: number;
}

const legalAttacks = (spy: IAttackSpy): ILegalAttack[] =>
  spy.mock.calls
    .map((args, index) => ({
      player: args[0],
      coord: args[1],
      result: spy.mock.results[index]?.value,
    }))
    .filter(
      (call): call is ILegalAttack =>
        typeof call.result === "number" && call.result >= 0,
    );

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

/** Seats the bot, lets it place its fleet, then places the human fleet. */
const startMatch = async (
  harness: IHarness,
  roomId: string,
): Promise<string> => {
  // The bot must be seated first: a room only enters Placement with both
  // players present.
  const bot = harness.runner.spawnBot(roomId);
  expect(bot).toBeDefined();

  // One bot turn is enough to place the whole fleet (placement retries are
  // internal). 2500 ms also covers easy/medium pacing.
  await vi.advanceTimersByTimeAsync(2500);
  expect(harness.room.getGameState(bot!.id)?.self.ready).toBe(true);

  expect(harness.room.placeShips(HUMAN_ID, createFleet())).toBe(true);
  expect(harness.room.getPhase()).toBe(EGamePhase.Playing);

  return bot!.id;
};

type TGameStateWithShips = TGameState & {
  phase: Exclude<EGamePhase, EGamePhase.Waiting>;
};

/**
 * Cells occupied by the fleet of `playerId` in that player's own game state.
 * Tests use it to aim at a known board, so a chosen side can be forced to win.
 * Returns an empty list when the state does not expose placed coordinates.
 */
const ownShipCells = (harness: IHarness, playerId: string): TCoordinate[] => {
  const ships =
    (harness.room.getGameState(playerId) as null | TGameStateWithShips)
      ?.ships ?? [];
  const cells: TCoordinate[] = [];

  for (const ship of ships) {
    const { coords, orientation, size } = ship;
    if (typeof coords?.x !== "number" || typeof coords?.y !== "number") {
      return [];
    }
    for (let i = 0; i < size; i++) {
      cells.push(
        orientation === "vertical"
          ? { x: coords.x, y: coords.y + i }
          : { x: coords.x + i, y: coords.y },
      );
    }
  }

  return cells;
};

/**
 * Plays a full match through the public room API. The human shoots at every
 * cell in row-major order (guaranteed to sink the fleet) unless an explicit
 * `aim` list is given, the bot is driven by its own scheduler. `broadcast`
 * mirrors `onRoomStateChanged` calls after a human move; without them the bot
 * has to rely on its 300 ms poll.
 */
const playToFinish = async (
  harness: IHarness,
  botId: string,
  {
    broadcast = true,
    aim = [],
  }: { broadcast?: boolean; aim?: TCoordinate[] } = {},
): Promise<void> => {
  const cells = aim.length > 0 ? aim : allCells();
  let next = 0;
  let guard = 0;

  while (harness.room.getPhase() !== EGamePhase.Finished) {
    if (guard++ > 300) throw new Error("match did not finish in 300 moves");

    if (harness.room.getTurn() === HUMAN_ID) {
      const cell = cells[next++];
      if (!cell) throw new Error("human ran out of cells");
      expect(harness.room.attack(HUMAN_ID, cell)).toBeGreaterThanOrEqual(0);
      if (broadcast) harness.runner.onRoomStateChanged(harness.room.id);
    } else {
      // Max delay is 1500 ms + one poll interval of slack.
      await vi.advanceTimersByTimeAsync(1600);
    }
  }

  expect(harness.room.getPhase()).toBe(EGamePhase.Finished);
  expect(harness.room.getGameState(botId)?.result).toBeDefined();
};

/* ------------------------------------------------------------------ */

describe("automatic opponent – end to end", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The bot id seed comes from Math.random(); pin it so a failure can be
    // reproduced from the test name alone.
    vi.spyOn(Math, "random").mockReturnValue(0.424242);
    // BotPlayer logs every decision – keep the reporter readable.
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const runner of runners.splice(0)) runner.disposeAll();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("seats a bot as a regular, flagged player and is idempotent", () => {
    const harness = setup("e2e-spawn");
    const { room, runner } = harness;

    expect(runner.spawnBot("missing-room")).toBeUndefined();
    expect(runner.hasBot(room.id)).toBe(false);

    const bot = runner.spawnBot(room.id);
    expect(bot).toBeDefined();
    expect(bot!.botLevel).toBe("hard");
    expect(bot!.id.startsWith(BOT_ID_PREFIX)).toBe(true);
    expect(isBotPlayerId(bot!.id)).toBe(true);
    expect(bot!.seed).toBeTypeOf("number");
    expect(room.getPlayer(bot!.id)).toMatchObject({
      id: bot!.id,
      botLevel: "hard",
    });

    // A second call in the same room must not seat another bot.
    expect(runner.spawnBot(room.id)?.id).toBe(bot!.id);
    expect(runner.botRoomIds).toEqual([room.id]);
    expect(runner.getBotPlayer(room.id)?.id).toBe(bot!.id);

    runner.disposeBot(room.id);
    expect(runner.hasBot(room.id)).toBe(false);
    expect(runner.getBotPlayer(room.id)).toBeUndefined();
    expect(runner.botRoomIds).toEqual([]);
  });

  it.each([
    { label: "room-state broadcasts", broadcast: true },
    { label: "the polling fallback only", broadcast: false },
  ])(
    "plays a complete match to the finish using $label",
    async ({ broadcast }) => {
      const roomId = `e2e-full-${broadcast}`;
      const harness = setup(roomId, { broadcast });
      const botId = await startMatch(harness, roomId);

      await playToFinish(harness, botId, { broadcast });

      const state = harness.room.getGameState(HUMAN_ID)!;
      expect(state.phase).toBe(EGamePhase.Finished);
      expect([state.result[HUMAN_ID], state.result[botId]].sort()).toEqual([
        "lost",
        "win",
      ]);

      const attacks = legalAttacks(harness.attackSpy);
      const botShots = attacks.filter(({ player }) => player === botId);
      const humanShots = attacks.filter(({ player }) => player === HUMAN_ID);

      expect(botShots.length).toBeGreaterThan(0);
      expect(humanShots.length).toBeGreaterThan(0);

      // The brain must never repeat a shot, and never leave the board.
      expect(new Set(botShots.map(({ coord }) => key(coord))).size).toBe(
        botShots.length,
      );
      for (const { coord } of botShots) {
        expect(coord.x).toBeGreaterThanOrEqual(0);
        expect(coord.x).toBeLessThan(10);
        expect(coord.y).toBeGreaterThanOrEqual(0);
        expect(coord.y).toBeLessThan(10);
      }

      // Every legal shot flips the turn: no player fires twice in a row.
      for (let i = 1; i < attacks.length; i++) {
        expect(attacks[i]!.player).not.toBe(attacks[i - 1]!.player);
      }

      // Every action of the bot reached the app-layer hook.
      expect(harness.actions.length).toBeGreaterThan(0);
      expect(new Set(harness.actions)).toEqual(new Set([roomId]));
    },
  );

  it("handles a rematch and re-places its fleet without human help", async () => {
    const roomId = "e2e-rematch";
    const harness = setup(roomId);
    const botId = await startMatch(harness, roomId);

    await playToFinish(harness, botId);

    const finished = harness.room.getGameState(HUMAN_ID)!;
    const humanWon = finished.result[HUMAN_ID] === "win";

    // Rematch flow: the loser asks, the winner accepts or rejects.
    if (humanWon) {
      // The bot lost, so it asks the human (the winner) for a rematch.
      harness.runner.onRoomStateChanged(roomId);
      await vi.advanceTimersByTimeAsync(2500);

      expect(harness.room.getGameState(HUMAN_ID)?.rematchRequest).toMatchObject(
        {
          requestorId: botId,
          status: "pending",
        },
      );

      // The human accepts the bot's request, which restarts the game.
      harness.room.acceptRematch(HUMAN_ID);
    } else {
      // The bot won, so it must not ask on its own; it only answers.
      harness.runner.onRoomStateChanged(roomId);
      await vi.advanceTimersByTimeAsync(2500);

      expect(
        harness.room.getGameState(HUMAN_ID)?.rematchRequest?.status,
      ).toBeUndefined();

      // The human lost, so the human asks and the bot accepts it.
      harness.room.requestRematch(HUMAN_ID);

      expect(harness.room.getGameState(HUMAN_ID)?.rematchRequest).toMatchObject(
        {
          requestorId: HUMAN_ID,
          status: "pending",
        },
      );

      harness.runner.onRoomStateChanged(roomId);
      await vi.advanceTimersByTimeAsync(2500);
    }

    // A rematch starts a fresh placement phase; both sides must be ready.
    expect(harness.room.getPhase()).toBe(EGamePhase.Placement);

    // The bot polls on its own after the rematch reset and re-places.
    await vi.advanceTimersByTimeAsync(2500);

    const nextBattle = harness.room.getGameState(botId)!;
    expect(nextBattle.self.ready).toBe(true);
    expect(nextBattle.phase).toBe(EGamePhase.Placement);

    // The human still has to place, so the new battle is not running yet.
    expect(harness.room.getPhase()).toBe(EGamePhase.Placement);
  });

  it.each([
    { label: "room-state broadcasts", broadcast: true },
    { label: "the polling fallback only", broadcast: false },
  ])(
    "lets the player reject the bot's rematch request ($label)",
    async ({ broadcast }) => {
      const roomId = `e2e-reject-${broadcast}`;
      const harness = setup(roomId, { broadcast });
      const botId = await startMatch(harness, roomId);

      // Aim at the bot's own board so the human sinks the fleet first: the
      // rejection path needs the bot to be the loser, i.e. the side allowed
      // to ask for a rematch.
      await playToFinish(harness, botId, {
        broadcast,
        aim: ownShipCells(harness, botId),
      });

      const finished = harness.room.getGameState(HUMAN_ID)!;
      expect(finished.result[HUMAN_ID]).toBe("win");
      expect(finished.result[botId]).toBe("lost");

      // The losing bot asks the winner for a rematch.
      harness.runner.onRoomStateChanged(roomId);
      await vi.advanceTimersByTimeAsync(2500);

      expect(harness.room.getGameState(HUMAN_ID)?.rematchRequest).toMatchObject(
        {
          requestorId: botId,
          status: "pending",
        },
      );

      // The player is the winner, so the player is the one who rejects.
      const rejectResult = harness.room.rejectRematch(HUMAN_ID);

      expect(rejectResult).toBe(1);

      const rejected = harness.room.getGameState(HUMAN_ID)!;
      expect(rejected.phase).toBe(EGamePhase.Finished);
      expect(rejected.rematchRequest).toMatchObject({
        requestorId: botId,
        status: "rejected",
      });

      const attacksBefore = legalAttacks(harness.attackSpy).length;
      await vi.advanceTimersByTimeAsync(5000);

      // A rejection must not restart the match, and the bot must not nag the
      // player again with a fresh request.
      const after = harness.room.getGameState(HUMAN_ID)!;
      expect(after.phase).toBe(EGamePhase.Finished);
      expect(after.rematchRequest).toMatchObject({
        requestorId: botId,
        status: "rejected",
      });
      expect(after.rematchRequest?.status).not.toBe("pending");
      expect(legalAttacks(harness.attackSpy).length).toBe(attacksBefore);
      expect(harness.room.getPhase()).toBe(EGamePhase.Finished);
    },
  );

  it("stops acting immediately after dispose", async () => {
    const roomId = "e2e-dispose";
    const harness = setup(roomId);
    await startMatch(harness, roomId);

    const before = legalAttacks(harness.attackSpy).length;
    harness.runner.disposeBot(roomId);

    expect(harness.runner.getBotPlayer(roomId)).toBeUndefined();
    expect(harness.runner.hasBot(roomId)).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);

    // No pending timer may survive the dispose.
    expect(legalAttacks(harness.attackSpy).length).toBe(before);
  });
});
