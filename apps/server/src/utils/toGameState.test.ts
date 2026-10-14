import { ECellStatus, EGamePhase, TRoomState } from "@repo/types";
import { toGameState } from "./toGameState";

describe("utils", () => {
  describe("toGameState", () => {
    const playerId = "test-player-id";
    const player = {
      id: playerId,
      name: "davy-test-jones",
      active: true,
      ready: false,
      seed: 1234,
      owner: true,
    };
    it("creates TGameState for EGamePhase.Waiting", () => {
      const waitinState: TRoomState = {
        id: "test-room-id",
        name: "test-seas",
        game_created: new Date(2026, 8, 25, 1, 2, 3, 4).toISOString(),
        game_finished: null,
        game_started: null,
        history: [],
        result: {},
        ships: { [playerId]: [] },
        boards: { [playerId]: [] },
        turn: playerId,
        phase: EGamePhase.Waiting,
        players: {
          [playerId]: player,
        },
        battles: [],
      };
      const result = toGameState(playerId, waitinState);

      expect(result).toEqual({
        id: waitinState.id,
        name: waitinState.name,
        phase: EGamePhase.Waiting,
        game_created: waitinState.game_created,
        game_finished: waitinState.game_finished,
        game_started: waitinState.game_started,
        result: waitinState.result,
        turn: waitinState.turn,
        self: player,
        myBoard: waitinState.boards[player.id] ?? [],
      });
    });
    it("creates TGameState for EGamePhase.Placement", () => {
      const enemyId = "enemy-player-id";
      const enemy = {
        id: enemyId,
        name: "blackbeard",
        active: true,
        ready: false,
        seed: 5678,
        owner: false,
      };
      const myShips = [
        {
          id: 1,
          size: 2,
          type: "pending" as const,
          placed: false,
        },
      ];
      const placementState: TRoomState = {
        id: "placement-room-id",
        name: "placement-seas",
        game_created: "2026-09-25T01:00:00.000Z",
        game_finished: null,
        game_started: null,
        history: [],
        result: {},
        ships: { [playerId]: myShips },
        boards: { [playerId]: [[ECellStatus.Empty]] },
        turn: playerId,
        phase: EGamePhase.Placement,
        players: {
          [playerId]: player,
          [enemyId]: enemy,
        },
        battles: [],
      };

      expect(toGameState(playerId, placementState)).toEqual({
        battleResults: {},
        id: placementState.id,
        name: placementState.name,
        phase: EGamePhase.Placement,
        game_created: placementState.game_created,
        game_finished: placementState.game_finished,
        game_started: placementState.game_started,
        result: placementState.result,
        turn: placementState.turn,
        self: player,
        enemy,
        myBoard: placementState.boards[playerId],
        ships: myShips,
      });
    });

    it("creates TGameState for other phases", () => {
      const enemyId = "enemy-player-id";
      const enemy = {
        id: enemyId,
        name: "blackbeard",
        active: true,
        ready: true,
        seed: 5678,
        owner: false,
      };
      const myShips = [
        {
          id: 1,
          size: 2,
          type: "placed" as const,
          coords: { x: 0, y: 0 },
          orientation: "horizontal" as const,
          hits: [],
        },
      ];
      const enemyShips = [
        {
          id: 2,
          size: 1,
          type: "placed" as const,
          coords: { x: 1, y: 0 },
          orientation: "vertical" as const,
          hits: [{ x: 1, y: 0 }],
        },
      ];
      const playingEnemyBoard = [
        [ECellStatus.Ship, ECellStatus.Hit, ECellStatus.Miss, 2],
      ];
      const playingState: TRoomState = {
        id: "playing-room-id",
        name: "playing-seas",
        game_created: "2026-09-25T02:00:00.000Z",
        game_finished: null,
        game_started: "2026-09-25T02:01:00.000Z",
        history: [],
        result: {},
        ships: { [playerId]: myShips, [enemyId]: enemyShips },
        boards: {
          [playerId]: [[ECellStatus.Empty]],
          [enemyId]:
            playingEnemyBoard as unknown as TRoomState["boards"][string],
        },
        turn: playerId,
        phase: EGamePhase.Playing,
        players: {
          [playerId]: player,
          [enemyId]: enemy,
        },
        battles: [
          {
            result: { [playerId]: "win" as const, [enemyId]: "lost" as const },
          } as unknown as TRoomState,
        ],
      };

      expect(toGameState(playerId, playingState)).toEqual({
        battleResults: {
          "enemy-player-id": 0,
          "test-player-id": 1,
        },
        id: playingState.id,
        name: playingState.name,
        phase: EGamePhase.Playing,
        game_created: playingState.game_created,
        game_finished: playingState.game_finished,
        game_started: playingState.game_started,
        result: playingState.result,
        turn: playingState.turn,
        self: player,
        enemy,
        ships: myShips,
        myBoard: playingState.boards[playerId],
        enemyBoard: [
          [
            ECellStatus.Empty,
            ECellStatus.Hit,
            ECellStatus.Miss,
            ECellStatus.Empty,
          ],
        ],
        enemyDestroyedShips: enemyShips,
      });

      const finishedState = {
        ...playingState,
        phase: EGamePhase.Finished as const,
        game_finished: "2026-09-25T02:02:00.000Z",
        result: { [playerId]: "win" as const, [enemyId]: "lost" as const },
      };

      expect(toGameState(playerId, finishedState)).toEqual({
        battleResults: {
          "enemy-player-id": 0,
          "test-player-id": 2,
        },
        id: finishedState.id,
        name: finishedState.name,
        phase: EGamePhase.Finished,
        game_created: finishedState.game_created,
        game_finished: finishedState.game_finished,
        game_started: finishedState.game_started,
        result: finishedState.result,
        turn: finishedState.turn,
        self: player,
        enemy,
        ships: myShips,
        myBoard: finishedState.boards[playerId],
        enemyBoard: playingEnemyBoard,
        enemyDestroyedShips: enemyShips,
      });
    });
  });
});
