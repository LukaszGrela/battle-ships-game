import { EGamePhase, IPlayer, TCellStatusShipId, TShip } from "@repo/types";
import { describe, expect, it } from "vitest";
import { BattleShips } from "./BattleShips";

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

const startSingleShipGame = () => {
  const game = new BattleShips(5, [1]);
  game.addPlayer(createPlayer("p1"));
  game.addPlayer(createPlayer("p2"));
  game.placeShips("p1", createPlacedFleet(1, 1, 1));
  game.placeShips("p2", createPlacedFleet(2, 3, 3));
  return game;
};

describe("BattleShips.getFinishSummary", () => {
  it("returns undefined while the game is still running", () => {
    const game = startSingleShipGame();

    expect(game.getPhase()).toBe(EGamePhase.Playing);
    expect(game.getFinishSummary()).toBeUndefined();
  });

  it("reports the winner of a battle finished by sinking the fleet", () => {
    const game = startSingleShipGame();

    expect(game.attack("p1", { x: 3, y: 3 })).toBe(1002);

    expect(game.getFinishSummary()).toEqual({
      finishedAt: expect.any(String),
      winnerId: "p1",
      loserId: "p2",
      byForfeit: false,
    });
  });

  it("marks a forfeit and points at the winner", () => {
    const game = startSingleShipGame();

    expect(game.forfeit("p1")).toBe(true);

    expect(game.getFinishSummary()).toEqual({
      finishedAt: expect.any(String),
      winnerId: "p2",
      loserId: "p1",
      byForfeit: true,
    });
  });

  it("keeps the timestamp stable between calls", () => {
    const game = startSingleShipGame();
    game.forfeit("p2");

    const first = game.getFinishSummary();
    const second = game.getFinishSummary();

    expect(first?.finishedAt).toEqual(second?.finishedAt);
  });
});
