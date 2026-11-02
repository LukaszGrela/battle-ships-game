import {
  EGamePhase,
  IPlayer,
  TAttackHistory,
  TCellStatusShipId,
  TGameState,
  TShip,
} from "@repo/types";
import { AVAILABLE_SHIPS } from "../constants";
import { BattleShips } from "./BattleShips";
import {
  isDestroyedShipStatus,
  isHitShipStatus,
} from "../board/BattleShipsBoard";
import { createEmptyBoard } from "../board/createEmptyBoard";

const createPlayer = (
  id: string,
  overrides: Partial<IPlayer> = {},
): IPlayer => ({
  id,
  name: `Player ${id}`,
  seed: 1,
  active: false,
  ready: true,
  ...overrides,
});

const serializedState = (game: BattleShips) =>
  JSON.parse(game.serialize()) as {
    version: number;
    game_created: string;
    game_finished: string | null;
    game_started: string | null;
    phase: EGamePhase;
    size: number;
    owner?: string;
    turn?: string;
    maxPlayers: number;
    availableShips: readonly number[];
    history: TAttackHistory[];

    players: Array<{ playerId: string; player: IPlayer }>;
    boards: Array<{ playerId: string; board: string }>;
  };

const playersFrom = (game: BattleShips) =>
  serializedState(game).players.map(({ player }) => player as IPlayer);

const createPlacedFleet = (
  id: TCellStatusShipId,
  x: number,
  y: number,
): (TShip & { type: "pending"; id: TCellStatusShipId })[] => [
  {
    id,
    size: 1,
    type: "pending",
    placed: true,
    coords: { x, y },
    orientation: "horizontal",
  },
];

const createPlacementGame = () => {
  const game = new BattleShips(5, [1]);
  game.addPlayer(createPlayer("p1"));
  game.addPlayer(createPlayer("p2"));
  return game;
};

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
      expect(
        serializedState(game).boards.map(({ playerId }) => playerId),
      ).toEqual(["p1"]);
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

    it("returns cloned player records and the other player as opponent", () => {
      const game = new BattleShips();
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));

      const player = game.getPlayer("p1");
      const opponent = game.getOpponent("p1");
      expect(player?.id).toBe("p1");
      expect(opponent?.id).toBe("p2");
      expect(game.getPlayer("missing")).toBeUndefined();
      expect(game.getOpponent("missing")).toBeUndefined();

      if (player) player.name = "mutated copy";
      expect(game.getPlayer("p1")?.name).toBe("Player p1");
    });
  });

  describe("activatePlayer", () => {
    it("activates an existing inactive player", () => {
      const game = new BattleShips();
      game.addPlayer(createPlayer("p1", { active: false }));

      expect(game.activatePlayer("p1")).toBe(true);
      expect(game.getPlayer("p1")?.active).toBe(true);
    });

    it("returns false and emits an error for an unknown player", () => {
      const game = new BattleShips();
      const listener = vi.fn();
      game.subscribe(listener);

      expect(game.activatePlayer("missing")).toBe(false);
      expect(listener).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: { message: 'Player "missing" does not exist.' },
      });
    });
  });

  describe("getTimeStamps", () => {
    it("reports creation time and tracks start and finish timestamps", () => {
      const game = createPlacementGame();
      const created = game.getTimeStamps();

      expect(created.game_created).toEqual(expect.any(String));
      expect(Date.parse(created.game_created ?? "")).not.toBeNaN();
      expect(created.game_started).toBeNull();
      expect(created.game_finished).toBeNull();

      game.placeShips("p1", createPlacedFleet(1, 1, 1));
      game.placeShips("p2", createPlacedFleet(2, 3, 3));
      const started = game.getTimeStamps();
      expect(started.game_created).toBe(created.game_created);
      expect(Date.parse(started.game_started!)).not.toBeNaN();
      expect(started.game_finished).toBeNull();

      game.attack("p1", { x: 3, y: 3 });
      const finished = game.getTimeStamps();
      expect(finished.game_created).toBe(created.game_created);
      expect(finished.game_started).toBe(started.game_started);
      expect(Date.parse(finished.game_finished!)).not.toBeNaN();
    });
  });

  describe("getResult", () => {
    it("returns no results before the game is finished, then reports winner and loser", () => {
      const game = createPlacementGame();

      expect(game.getResult()).toEqual({});

      game.placeShips("p1", createPlacedFleet(1, 1, 1));
      game.placeShips("p2", createPlacedFleet(2, 3, 3));
      expect(game.getResult()).toEqual({});

      game.attack("p1", { x: 3, y: 3 });

      expect(game.getPhase()).toBe(EGamePhase.Finished);
      expect(game.getResult()).toEqual({ p1: "win", p2: "lost" });
    });
  });

  describe("ship placement", () => {
    it("rejects invalid count, unknown player, and calls outside placement with error events", () => {
      const waitingGame = new BattleShips(5, [1]);
      const waitingEvents = vi.fn();
      waitingGame.subscribe(waitingEvents);
      expect(waitingGame.placeShips("p1", createPlacedFleet(1, 1, 1))).toBe(
        false,
      );
      expect(waitingEvents).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: {
          message:
            "Invalid game phase. Ships can be added ONLY during placement phase.",
        },
      });

      const game = createPlacementGame();
      const events = vi.fn();
      game.subscribe(events);
      expect(game.placeShips("missing", createPlacedFleet(1, 1, 1))).toBe(
        false,
      );
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: { message: 'Player "missing" does not exist.' },
      });

      expect(game.placeShips("p1", [])).toBe(false);
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: { message: "Invalid number of ships to be placed." },
      });
    });

    it("rolls back all ships if any ship placement in a fleet fails", () => {
      const game = new BattleShips(6, [1, 1]);
      game.addPlayer(createPlayer("p1"));
      game.addPlayer(createPlayer("p2"));
      const events = vi.fn();
      game.subscribe(events);
      const ships: (TShip & {
        type: "pending";
        id: TCellStatusShipId;
      })[] = [...createPlacedFleet(1, 1, 1), ...createPlacedFleet(2, 1, 1)];

      expect(game.placeShips("p1", ships)).toBe(false);
      expect(game.getPlayer("p1")?.ready).toBe(false);
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: { message: "Incorrectly placed ships." },
      });

      const state = serializedState(game);
      const p1Board = state.boards.find(({ playerId }) => playerId === "p1");
      expect(p1Board).toBeDefined();
      expect(JSON.parse(p1Board!.board).ships).toEqual([]);
    });

    it("marks a player ready and publishes readiness events after successful placement", () => {
      const game = createPlacementGame();
      const events = vi.fn();
      game.subscribe(events);

      expect(game.placeShips("p1", createPlacedFleet(1, 1, 1))).toBe(true);
      expect(game.getPlayer("p1")?.ready).toBe(true);
      expect(game.getPhase()).toBe(EGamePhase.Placement);
      expect(events).toHaveBeenCalledWith({ type: "BattleShips:ships_placed" });
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:player_ready",
        payload: expect.objectContaining({ id: "p1", ready: true }),
      });
    });

    it("starts the game once both players have placed their fleets", () => {
      const game = createPlacementGame();
      const events = vi.fn();
      game.subscribe(events);

      expect(game.placeShips("p1", createPlacedFleet(1, 1, 1))).toBe(true);
      expect(game.getPhase()).toBe(EGamePhase.Placement);
      expect(game.placeShips("p2", createPlacedFleet(2, 3, 3))).toBe(true);

      expect(game.getPhase()).toBe(EGamePhase.Playing);
      expect(game.getTurn()).toBe("p1");
      expect(serializedState(game).history).toEqual([{ init: true }]);
      expect(serializedState(game).game_started).toEqual(expect.any(String));
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:phase_changed",
      });
    });
  });

  describe("attacks", () => {
    const startSingleShipGame = () => {
      const game = createPlacementGame();
      game.placeShips("p1", createPlacedFleet(1, 1, 1));
      game.placeShips("p2", createPlacedFleet(2, 3, 3));
      return game;
    };

    it("rejects attacks outside playing phase and attacks from the wrong turn", () => {
      const game = createPlacementGame();
      const events = vi.fn();
      game.subscribe(events);

      expect(game.attack("p1", { x: 3, y: 3 })).toBe(0);
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: {
          message:
            "Invalid game phase. Player can attack ONLY during playing phase.",
        },
      });

      game.placeShips("p1", createPlacedFleet(1, 1, 1));
      game.placeShips("p2", createPlacedFleet(2, 3, 3));
      expect(game.attack("p2", { x: 1, y: 1 })).toBe(0);
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:error",
        payload: { message: "Not your turn." },
      });
    });

    it("records misses, publishes results, and passes the turn to the opponent", () => {
      const game = startSingleShipGame();
      const events = vi.fn();
      game.subscribe(events);

      expect(game.attack("p1", { x: 0, y: 0 })).toBe(0);
      expect(game.getTurn()).toBe("p2");
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:attack_result",
        payload: 0,
      });
      expect(serializedState(game).history.at(-1)).toEqual({
        coords: { x: 0, y: 0 },
        isSunk: false,
        result: 0,
        turn: "p1",
        size: 0,
      });

      expect(game.attack("p2", { x: 0, y: 0 })).toBe(0);
      expect(game.getTurn()).toBe("p1");
    });

    it("finishes the game when the final ship is sunk and records the winner", () => {
      const game = startSingleShipGame();
      const events = vi.fn();
      game.subscribe(events);

      expect(game.attack("p1", { x: 3, y: 3 })).toBe(1002);

      expect(game.getPhase()).toBe(EGamePhase.Finished);
      expect(game.getTurn()).toBe("p1");
      expect(serializedState(game).game_finished).toEqual(expect.any(String));
      expect(serializedState(game).history).toEqual([
        { init: true },
        {
          coords: { x: 3, y: 3 },
          isSunk: true,
          result: 1002,
          turn: "p1",
          size: 1,
        },
        { finish: true, whoWon: "p1" },
      ]);
      expect(events).toHaveBeenLastCalledWith({
        type: "BattleShips:phase_changed",
      });
      expect(game.attack("p1", { x: 1, y: 1 })).toBe(0);
    });
  });

  describe("events", () => {
    it("immediately notifies a new subscriber and publishes phase changes", () => {
      const game = new BattleShips();
      const listener = vi.fn();

      const unsubscribe = game.subscribe(listener);
      expect(listener).toHaveBeenNthCalledWith(1, {
        type: "BattleShips:update",
      });

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
      expect(state.boards.map(({ playerId }) => playerId)).toEqual([
        "p1",
        "p2",
      ]);
      expect(state.boards[0]?.board).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      expect(JSON.parse(state.boards[0]?.board!).board).toBeDefined();
    });

    it("preserves turn, timestamps, and attack history when restored during play", () => {
      const game = createPlacementGame();
      game.placeShips("p1", createPlacedFleet(1, 1, 1));
      game.placeShips("p2", createPlacedFleet(2, 3, 3));
      game.attack("p1", { x: 0, y: 0 });

      const before = serializedState(game);
      const restored = BattleShips.deserialize(game.serialize());
      const after = serializedState(restored);

      expect(restored.getPhase()).toBe(EGamePhase.Playing);
      expect(restored.getTurn()).toBe("p2");
      expect(after.history).toEqual(before.history);
      expect(after.game_created).toBe(before.game_created);
      expect(after.game_started).toBe(before.game_started);
      expect(after.game_finished).toBeNull();
      expect(restored.getPlayer("p1")?.ready).toBe(true);
    });
  });

  describe("getGameState", () => {
    it("goes from waiting to finish - happy path", () => {
      const size = 4;
      const availableShips = [1, 1, 2] as const;
      const game = new BattleShips(size, availableShips);

      expect(game.getPhase()).toBe(EGamePhase.Waiting);
      expect(game.getTurn()).toBeUndefined();

      expect(game.getGameState("lukasz")).toBeNull();

      expect(
        game.addPlayer({
          id: "lukasz",
          name: "Lukasz",
          seed: 1979,
          active: true,
        }),
      ).toBe(true);

      const lukasz: IPlayer = {
        active: true,
        id: "lukasz",
        name: "Lukasz",
        owner: true,
        ready: false,
        seed: 1979,
      };
      // waiting
      const stateWaiting = game.getGameState("lukasz");
      expect(stateWaiting?.phase).toEqual(EGamePhase.Waiting);
      expect(stateWaiting?.self).toEqual(lukasz);
      expect(stateWaiting?.myBoard).toEqual(createEmptyBoard(size, -1));

      expect(
        game.addPlayer({
          id: "marek",
          name: "Marek",
          seed: 1980,
          active: true,
        }),
      ).toBe(true);

      expect(game.getPhase()).toBe(EGamePhase.Placement);
      expect(game.getTurn()).toBe("lukasz");

      /*
        // marek
        [   0.  1.  2.  3
        0.[-1,  3, -1,  1],
        1.[-1,  3, -1, -1],
        2.[-1, -1, -1, -1],
        3.[ 2, -1, -1, -1],
        ]
        // lukasz
        [   0.  1.  2.  3
        0.[ 1, -1, -1, -1],
        1.[-1, -1, -1, -1],
        2.[ 3,  3, -1, -1],
        3.[-1, -1, -1,  2],
        ]
    */
      // should have list of pending ships
      expect(
        (
          game.getGameState("lukasz") as TGameState & {
            phase: EGamePhase.Placement;
          }
        ).ships,
      ).toEqual([
        {
          id: 1,
          placed: false,
          size: 1,
          type: "pending",
        },
        {
          id: 2,
          placed: false,
          size: 1,
          type: "pending",
        },
        {
          id: 3,
          placed: false,
          size: 2,
          type: "pending",
        },
      ]);

      expect(
        game.placeShips("lukasz", [
          {
            id: 1,
            placed: true,
            size: 1,
            type: "pending",
            coords: { x: 0, y: 0 },
            orientation: "horizontal",
          },
          {
            id: 2,
            placed: true,
            size: 1,
            type: "pending",
            coords: { x: 3, y: 3 },
            orientation: "vertical",
          },
          {
            id: 3,
            placed: true,
            size: 2,
            type: "pending",
            coords: { x: 0, y: 2 },
            orientation: "horizontal",
          },
        ]),
      ).toBe(true);

      const statePlacement = game.getGameState("lukasz") as TGameState & {
        phase: EGamePhase.Placement;
      };
      expect(statePlacement?.phase).toEqual(EGamePhase.Placement);

      expect(statePlacement?.self).toEqual({
        ...lukasz,
        ready: true,
      });
      expect(statePlacement?.myBoard).toEqual([
        [1, -1, -1, -1],
        [-1, -1, -1, -1],
        [3, 3, -1, -1],
        [-1, -1, -1, 2],
      ]);
      expect(statePlacement?.ships).toEqual([
        {
          coords: {
            x: 0,
            y: 0,
          },
          hits: [],
          id: 1,
          orientation: "horizontal",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 3,
            y: 3,
          },
          hits: [],
          id: 2,
          orientation: "vertical",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 0,
            y: 2,
          },
          hits: [],
          id: 3,
          orientation: "horizontal",
          placed: true,
          size: 2,
          type: "placed",
        },
      ]);
      const marek: IPlayer = {
        active: true,
        id: "marek",
        name: "Marek",
        ready: false,
        seed: 1980,
      };
      expect(statePlacement?.enemy).toEqual(marek);

      expect(
        game.placeShips("marek", [
          {
            id: 1,
            placed: true,
            size: 1,
            type: "pending",
            coords: { x: 3, y: 0 },
            orientation: "horizontal",
          },
          {
            id: 2,
            placed: true,
            size: 1,
            type: "pending",
            coords: { x: 0, y: 3 },
            orientation: "vertical",
          },
          {
            id: 3,
            placed: true,
            size: 2,
            type: "pending",
            coords: { x: 1, y: 0 },
            orientation: "vertical",
          },
        ]),
      ).toBe(true);

      expect(game.getPhase()).toBe(EGamePhase.Playing);

      expect(game.attack("lukasz", { x: 0, y: 0 })).toBe(0); // miss
      expect(game.getTurn()).toBe("marek");
      expect(isDestroyedShipStatus(game.attack("marek", { x: 0, y: 0 }))).toBe(
        true,
      ); // hit, destroy
      expect(game.getTurn()).toBe("lukasz");
      expect(isDestroyedShipStatus(game.attack("lukasz", { x: 3, y: 0 }))).toBe(
        true,
      ); // hit, destroy
      expect(game.getTurn()).toBe("marek");
      expect(game.attack("marek", { x: 3, y: 0 })).toBe(0); // miss
      expect(game.getTurn()).toBe("lukasz");

      const statePlayingLukasz = game.getGameState("lukasz") as TGameState & {
        phase: EGamePhase.Playing;
      };
      const statePlayingMarek = game.getGameState("marek") as TGameState & {
        phase: EGamePhase.Playing;
      };
      expect(statePlayingLukasz?.phase).toEqual(EGamePhase.Playing);
      expect(statePlayingMarek?.phase).toEqual(EGamePhase.Playing);

      expect(statePlayingLukasz?.self).toEqual({ ...lukasz, ready: true });
      expect(statePlayingMarek?.self).toEqual({ ...marek, ready: true });

      expect(statePlayingLukasz?.enemy).toEqual({ ...marek, ready: true });
      expect(statePlayingMarek?.enemy).toEqual({ ...lukasz, ready: true });

      expect(statePlayingLukasz?.turn).toEqual("lukasz");
      expect(statePlayingMarek?.turn).toEqual("lukasz");

      expect(statePlayingLukasz?.myBoard).toEqual([
        [1001, -1, -1, 0], // hit destroyed,,,miss
        [-1, -1, -1, -1],
        [3, 3, -1, -1],
        [-1, -1, -1, 2],
      ]);
      expect(statePlayingMarek?.myBoard).toEqual([
        [0, 3, -1, 1001], // miss,,,hit destroyed
        [-1, 3, -1, -1],
        [-1, -1, -1, -1],
        [2, -1, -1, -1],
      ]);
      expect(statePlayingLukasz?.enemyBoard).toEqual([
        [0, -1, -1, 1001], // miss,,,hit destroyed
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
      ]);
      expect(statePlayingMarek?.enemyBoard).toEqual([
        [1001, -1, -1, 0], // hit destroyed,,,miss
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
      ]);
      expect(statePlayingLukasz?.ships).toEqual([
        {
          coords: {
            x: 0,
            y: 0,
          },
          hits: [
            {
              x: 0,
              y: 0,
            },
          ],
          id: 1,
          orientation: "horizontal",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 3,
            y: 3,
          },
          hits: [],
          id: 2,
          orientation: "vertical",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 0,
            y: 2,
          },
          hits: [],
          id: 3,
          orientation: "horizontal",
          placed: true,
          size: 2,
          type: "placed",
        },
      ]);
      expect(statePlayingMarek?.ships).toEqual([
        {
          coords: {
            x: 3,
            y: 0,
          },
          hits: [
            {
              x: 3,
              y: 0,
            },
          ],
          id: 1,
          orientation: "horizontal",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 0,
            y: 3,
          },
          hits: [],
          id: 2,
          orientation: "vertical",
          placed: true,
          size: 1,
          type: "placed",
        },
        {
          coords: {
            x: 1,
            y: 0,
          },
          hits: [],
          id: 3,
          orientation: "vertical",
          placed: true,
          size: 2,
          type: "placed",
        },
      ]);
      expect(statePlayingLukasz?.enemyDestroyedShips).toEqual([
        {
          coords: {
            x: 3,
            y: 0,
          },
          hits: [
            {
              x: 3,
              y: 0,
            },
          ],
          id: 1,
          orientation: "horizontal",
          placed: true,
          size: 1,
          type: "placed",
        },
      ]);
      expect(statePlayingMarek?.enemyDestroyedShips).toEqual([
        {
          coords: {
            x: 0,
            y: 0,
          },
          hits: [
            {
              x: 0,
              y: 0,
            },
          ],
          id: 1,
          orientation: "horizontal",
          placed: true,
          size: 1,
          type: "placed",
        },
      ]);
      expect(statePlayingLukasz?.lastAttack).toEqual({
        coords: {
          x: 3,
          y: 0,
        },
        isSunk: false,
        result: 0,
        size: 0,
        turn: "marek",
      });
      expect(statePlayingMarek?.lastAttack).toBeUndefined();

      expect(game.attack("lukasz", { x: 3, y: 3 })).toBe(0); // miss
      expect(game.getTurn()).toBe("marek");
      expect(game.attack("marek", { x: 0, y: 3 })).toBe(0); // miss
      expect(game.getTurn()).toBe("lukasz");
      expect(isDestroyedShipStatus(game.attack("lukasz", { x: 0, y: 3 }))).toBe(
        true,
      ); // hit, destroy
      expect(game.getTurn()).toBe("marek");
      expect(isDestroyedShipStatus(game.attack("marek", { x: 3, y: 3 }))).toBe(
        true,
      ); // hit, destroy
      expect(game.getTurn()).toBe("lukasz");
      expect(game.attack("lukasz", { x: 0, y: 2 })).toBe(0); // miss
      expect(game.getTurn()).toBe("marek");
      // log("fleetDestroyed", game.fleetDestroyed());
      expect(isHitShipStatus(game.attack("marek", { x: 0, y: 2 }))).toBe(true); // hit
      expect(game.getTurn()).toBe("lukasz");
      expect(game.attack("lukasz", { x: 1, y: 2 })).toBe(0); // miss
      expect(game.getTurn()).toBe("marek");
      expect(isDestroyedShipStatus(game.attack("marek", { x: 1, y: 2 }))).toBe(
        true,
      ); // hit, destroy, winner, turn not changed
      expect(game.getTurn()).toBe("marek");
      expect(game.getPhase()).toBe(EGamePhase.Finished);

      const stateFinishedLukasz = game.getGameState("lukasz") as TGameState & {
        phase: EGamePhase.Finished;
      };
      const stateFinishedMarek = game.getGameState("marek") as TGameState & {
        phase: EGamePhase.Finished;
      };

      const finishedStates = [stateFinishedLukasz, stateFinishedMarek];
      expect(finishedStates.map(({ phase }) => phase)).toEqual([
        EGamePhase.Finished,
        EGamePhase.Finished,
      ]);

      for (const state of finishedStates) {
        expect(state.game_created).toEqual(expect.any(String));
        expect(state.game_started).toEqual(expect.any(String));
        expect(state.game_finished).toEqual(expect.any(String));
        expect(state.turn).toBe("marek");
        expect(state.result).toEqual({ lukasz: "lost", marek: "win" });
      }

      expect(stateFinishedLukasz.self).toEqual({ ...lukasz, ready: true });
      expect(stateFinishedLukasz.enemy).toEqual({ ...marek, ready: true });
      expect(stateFinishedMarek.self).toEqual({ ...marek, ready: true });
      expect(stateFinishedMarek.enemy).toEqual({ ...lukasz, ready: true });

      const lukaszBoardAfterGame = [
        [1001, -1, -1, 0],
        [-1, -1, -1, -1],
        [1003, 1003, -1, -1],
        [0, -1, -1, 1002],
      ];
      const marekBoardAfterGame = [
        [0, 3, -1, 1001],
        [-1, 3, -1, -1],
        [0, 0, -1, -1],
        [1002, -1, -1, 0],
      ];
      expect(stateFinishedLukasz.myBoard).toEqual(lukaszBoardAfterGame);
      expect(stateFinishedLukasz.enemyBoard).toEqual(marekBoardAfterGame);
      expect(stateFinishedMarek.myBoard).toEqual(marekBoardAfterGame);
      expect(stateFinishedMarek.enemyBoard).toEqual(lukaszBoardAfterGame);

      const shipHits = (state: typeof stateFinishedLukasz) =>
        state.ships.map((ship) => [ship.id, "hits" in ship ? ship.hits : []]);
      expect(shipHits(stateFinishedLukasz)).toEqual([
        [1, [{ x: 0, y: 0 }]],
        [2, [{ x: 3, y: 3 }]],
        [
          3,
          [
            { x: 0, y: 2 },
            { x: 1, y: 2 },
          ],
        ],
      ]);
      expect(shipHits(stateFinishedMarek)).toEqual([
        [1, [{ x: 3, y: 0 }]],
        [2, [{ x: 0, y: 3 }]],
        [3, []],
      ]);
      expect(stateFinishedMarek.enemyDestroyedShips).toEqual(
        stateFinishedLukasz.ships,
      );
      expect(stateFinishedLukasz.enemyDestroyedShips).toEqual(
        stateFinishedMarek.ships,
      );

      // console.log(JSON.stringify(`${game.serialize()}`));
    });
  });
});
