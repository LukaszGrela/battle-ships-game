import { EGamePhase, IPlayer } from "@repo/types";
import { AVAILABLE_SHIPS } from "../constants";
import { BattleShips } from "./BattleShips";

const createPlayer = (id: string, overrides: Partial<IPlayer> = {}): IPlayer => ({
  id,
  name: `Player ${id}`,
  seed: 1,
  active: false,
  ready: true,
  ...overrides,
});

const serializedState = (game: BattleShips) =>
  JSON.parse(game.serialize()) as {
    phase: EGamePhase;
    size: number;
    owner?: string;
    availableShips: number[];
    players: Array<{ playerId: string; player: string }>;
    boards: Array<{ playerId: string; board: string }>;
  };

const playersFrom = (game: BattleShips) =>
  serializedState(game).players.map(({ player }) => JSON.parse(player) as IPlayer);

describe("BattleShips", () => {
  describe("construction", () => {
    it("starts in waiting phase with default size and ships", () => {
      const game = new BattleShips();
      const state = serializedState(game);

      expect(game.getPhase()).toBe(EGamePhase.Waiting);
      expect(state.size).toBe(10);
      expect(state.availableShips).toEqual(AVAILABLE_SHIPS);
      expect(state.players).toEqual([]);
      expect(state.boards).toEqual([]);
    });

    it("uses the provided board size and available ships", () => {
      const game = new BattleShips(6, [2, 1]);
      const state = serializedState(game);

      expect(state.size).toBe(6);
      expect(state.availableShips).toEqual([2, 1]);
    });
  });

  describe("players", () => {
    it("adds the first player as owner and initializes readiness and activity", () => {
      const game = new BattleShips(4);
      const player = createPlayer("p1");

      expect(game.addPlayer(player)).toBe(true);
      expect(game.getPhase()).toBe(EGamePhase.Waiting);
      expect(serializedState(game).owner).toBe("p1");
      expect(playersFrom(game)).toEqual([
        { ...player, active: true, ready: false, owner: true },
      ]);
      expect(serializedState(game).boards).toHaveLength(1);
    });

    it("rejects duplicate players and players beyond the two-player limit", () => {
      const game = new BattleShips();

      expect(game.addPlayer(createPlayer("p1"))).toBe(true);
      expect(game.addPlayer(createPlayer("p1", { name: "Duplicate" }))).toBe(
        false,
      );
      expect(game.addPlayer(createPlayer("p2"))).toBe(true);
      expect(game.addPlayer(createPlayer("p3"))).toBe(false);
      expect(game.getPhase()).toBe(EGamePhase.Placement);
      expect(serializedState(game).players).toHaveLength(2);
    });

    it("updates an existing player while preserving unspecified properties", () => {
      const game = new BattleShips();
      game.addPlayer(createPlayer("p1"));

      expect(game.updatePlayer({ id: "p1", name: "Renamed", seed: 42 })).toBe(
        true,
      );
      expect(playersFrom(game)[0]).toEqual({
        ...createPlayer("p1"),
        name: "Renamed",
        seed: 42,
        active: true,
        ready: false,
        owner: true,
      });
      expect(game.updatePlayer({ id: "unknown", name: "Nobody" })).toBe(false);
    });

    it("removes a waiting player and transfers ownership to the remaining player", () => {
      const game = new BattleShips();
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));
      game.removePlayer("p2");

      expect(game.removePlayer("p2")).toBe(false);
      expect(game.getPhase()).toBe(EGamePhase.Waiting);
      expect(serializedState(game).owner).toBe("p1");
      expect(playersFrom(game)).toEqual([
        { ...createPlayer("p1"), active: true, ready: false, owner: true },
      ]);
      expect(serializedState(game).boards.map(({ playerId }) => playerId)).toEqual([
        "p1",
      ]);
    });

    it("returns to waiting and transfers ownership when a placement player leaves", () => {
      const game = new BattleShips();
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));
      expect(game.getPhase()).toBe(EGamePhase.Placement);

      expect(game.removePlayer("p1")).toBe(true);

      expect(game.getPhase()).toBe(EGamePhase.Waiting);
      expect(serializedState(game).owner).toBe("p2");
      expect(playersFrom(game)).toEqual([
        { ...createPlayer("p2"), active: true, ready: false, owner: true },
      ]);
    });

    it("does not remove unknown players", () => {
      const game = new BattleShips();

      expect(game.removePlayer("unknown")).toBe(false);
      expect(serializedState(game).players).toEqual([]);
    });
  });

  describe("events", () => {
    it("immediately notifies a new subscriber and publishes phase changes", () => {
      const game = new BattleShips();
      const listener = vi.fn();

      const unsubscribe = game.subscribe(listener);
      expect(listener).toHaveBeenNthCalledWith(1, { type: "BattleShips:update" });

      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));

      expect(listener).toHaveBeenNthCalledWith(2, {
        type: "BattleShips:phase_changed",
      });

      expect(unsubscribe()).toBe(true);
      expect(unsubscribe()).toBe(false);
      expect(game.removePlayer("p1")).toBe(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("does not add the same listener more than once", () => {
      const game = new BattleShips();
      const listener = vi.fn();

      game.subscribe(listener);
      game.subscribe(listener);
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));

      expect(listener).toHaveBeenCalledTimes(2);
      expect(game.unsubscribe(listener)).toBe(true);
      expect(game.unsubscribe(listener)).toBe(false);
    });
  });

  describe("serialization", () => {
    it("round-trips phase, players, boards, and game settings", () => {
      const game = new BattleShips(5, [2, 1]);
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));

      const restored = BattleShips.deserialize(game.serialize());
      const state = serializedState(restored);

      expect(restored).toBeInstanceOf(BattleShips);
      expect(restored.getPhase()).toBe(EGamePhase.Placement);
      expect(state.size).toBe(5);
      expect(state.owner).toBe("p1");
      expect(state.availableShips).toEqual([2, 1]);
      expect(playersFrom(restored)).toEqual(playersFrom(game));
      expect(state.boards.map(({ playerId }) => playerId)).toEqual(["p1", "p2"]);
      expect(JSON.parse(state.boards[0]?.board!).board).toBeDefined();
    });
  });
});
