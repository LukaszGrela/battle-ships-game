import { describe, expect, it } from "vitest";
import type { TCoordinate } from "@repo/types";
import { ProbabilityBrain } from "./ProbabilityBrain";
import type { TAttackOutcome } from "./types";

/* ------------------------------------------------------------------ */
/* Helpers – outcome codes as produced by BattleShips                  */
/* ------------------------------------------------------------------ */

const MISS = 0 as TAttackOutcome;
/** ship hit: 100 + shipId -> 101..110 */
const hitOutcome = (shipId: number) => (100 + shipId) as TAttackOutcome;
/** ship destroyed: 1000 + shipId -> 1001..1010 */
const sunkOutcome = (shipId: number) => (1000 + shipId) as TAttackOutcome;

const key = ({ x, y }: TCoordinate) => `${x},${y}`;

const inParity = ({ x, y }: TCoordinate) => (x + y) % 2 === 0;

type TOrientation = "horizontal" | "vertical";

interface IPlacedShip {
  id: number;
  size: number;
  x: number;
  y: number;
  orientation: TOrientation;
}

const shipCells = ({ x, y, size, orientation }: IPlacedShip): TCoordinate[] =>
  Array.from({ length: size }, (_, k) =>
    orientation === "horizontal" ? { x: x + k, y } : { x, y: y + k },
  );

/** Minimal enemy board: resolves the same outcome codes the server sends. */
class FakeEnemyBoard {
  private readonly cells = new Map<string, IPlacedShip>();
  private readonly hits = new Map<number, number>();

  constructor(private readonly ships: IPlacedShip[]) {
    for (const ship of ships) {
      for (const cell of shipCells(ship)) {
        this.cells.set(key(cell), ship);
      }
    }
  }

  shoot(shot: TCoordinate): TAttackOutcome {
    const ship = this.cells.get(key(shot));
    if (!ship) return MISS;

    const hits = (this.hits.get(ship.id) ?? 0) + 1;
    this.hits.set(ship.id, hits);

    return hits === ship.size
      ? sunkOutcome(ship.id)
      : hitOutcome(ship.id);
  }

  get sunkCount(): number {
    return this.ships.filter((ship) => this.hits.get(ship.id) === ship.size)
      .length;
  }

  get allSunk(): boolean {
    return this.sunkCount === this.ships.length;
  }
}

/** Mirrors `AVAILABLE_SHIPS = [5, 4, 3, 3, 2]` (17 cells). */
const FLEET = [
  { id: 1, size: 5 },
  { id: 2, size: 4 },
  { id: 3, size: 3 },
  { id: 4, size: 3 },
  { id: 5, size: 2 },
];

const LAYOUT: IPlacedShip[] = [
  { id: 1, size: 5, x: 2, y: 1, orientation: "horizontal" },
  { id: 2, size: 4, x: 7, y: 3, orientation: "vertical" },
  { id: 3, size: 3, x: 0, y: 5, orientation: "horizontal" },
  { id: 4, size: 3, x: 4, y: 7, orientation: "vertical" },
  { id: 5, size: 2, x: 8, y: 8, orientation: "horizontal" },
];

/* ------------------------------------------------------------------ */

describe("ProbabilityBrain", () => {
  describe("fleet setup", () => {
    it("keeps every shot inside the default 10x10 board", () => {
      const brain = new ProbabilityBrain();
      brain.setFleet(FLEET);

      const shots: string[] = [];
      for (let i = 0; i < 40; i++) {
        const shot = brain.nextShot();
        expect(shot.x).toBeGreaterThanOrEqual(0);
        expect(shot.x).toBeLessThan(10);
        expect(shot.y).toBeGreaterThanOrEqual(0);
        expect(shot.y).toBeLessThan(10);
        shots.push(key(shot));
        brain.report(shot, MISS);
      }

      expect(new Set(shots).size).toBe(shots.length);
    });

    it("honours a custom board size", () => {
      const brain = new ProbabilityBrain({ size: 4 });
      brain.setFleet([{ id: 1, size: 2 }]);

      for (let i = 0; i < 8; i++) {
        const shot = brain.nextShot();
        expect(shot.x).toBeLessThan(4);
        expect(shot.y).toBeLessThan(4);
        brain.report(shot, MISS);
      }
    });

    it("is reproducible for the same seed", () => {
      const play = (seed: number) => {
        const brain = new ProbabilityBrain({ size: 10, seed });
        brain.setFleet([{ id: 1, size: 3 }]);

        const shots: string[] = [];
        for (let i = 0; i < 12; i++) {
          const shot = brain.nextShot();
          shots.push(key(shot));
          brain.report(shot, MISS);
        }
        return shots;
      };

      expect(play(13)).toEqual(play(13));
    });

    it("forgets the previous game when a new fleet is injected", () => {
      const brain = new ProbabilityBrain({ size: 3 });
      brain.setFleet([{ id: 1, size: 2 }]);

      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) brain.report({ x, y }, MISS);
      }
      expect(() => brain.nextShot()).toThrow(/no cells left/);

      // rematch: the board must be empty again
      brain.setFleet([{ id: 1, size: 2 }]);
      expect(() => brain.nextShot()).not.toThrow();
    });

    it("revives sunk ships when a new fleet is injected", () => {
      const brain = new ProbabilityBrain({ size: 10, seed: 3 });
      brain.setFleet([{ id: 1, size: 3 }]);

      brain.report({ x: 0, y: 0 }, hitOutcome(1));
      brain.report({ x: 1, y: 0 }, hitOutcome(1));
      brain.report({ x: 2, y: 0 }, sunkOutcome(1));

      brain.setFleet([{ id: 1, size: 3 }]);

      // with the ship alive the density map prefers the centre, never a corner
      expect(brain.nextShot()).not.toEqual({ x: 0, y: 0 });
    });
  });

  describe("hunting", () => {
    it("prefers parity cells while the smallest ship is at least 2 long", () => {
      const brain = new ProbabilityBrain({ size: 10, seed: 9 });
      brain.setFleet([
        { id: 1, size: 2 },
        { id: 2, size: 3 },
      ]);

      expect(inParity(brain.nextShot())).toBe(true);
    });

    it("shoots where the remaining ships can actually fit", () => {
      // Only row 2 is free, so a size-3 ship can only sit at x = 0, 1 or 2.
      // Weighted density: (0,2)=1, (1,2)=2, (2,2)=3, (3,2)=2, (4,2)=1.
      const brain = new ProbabilityBrain({ size: 5, seed: 42 });
      brain.setFleet([{ id: 1, size: 3 }]);

      for (let y = 0; y < 5; y++) {
        if (y === 2) continue;
        for (let x = 0; x < 5; x++) brain.report({ x, y }, MISS);
      }

      expect(brain.nextShot()).toEqual({ x: 2, y: 2 });
    });

    it("falls back to any cell when the parity class is exhausted", () => {
      const brain = new ProbabilityBrain({ size: 3, seed: 11 });
      brain.setFleet([{ id: 1, size: 2 }]);

      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          if (inParity({ x, y })) brain.report({ x, y }, MISS);
        }
      }

      expect(inParity(brain.nextShot())).toBe(false);
    });

    it("spreads shots randomly when blunderChance is 1", () => {
      const firsts = new Set<string>();

      for (let seed = 1; seed <= 25; seed++) {
        const brain = new ProbabilityBrain({ size: 10, seed, blunderChance: 1 });
        brain.setFleet(FLEET);
        firsts.add(key(brain.nextShot()));
      }

      expect(firsts.size).toBeGreaterThanOrEqual(8);
    });
  });

  describe("pursuit", () => {
    it("stays in line with a damaged ship even with blunderChance 1", () => {
      const brain = new ProbabilityBrain({
        size: 10,
        seed: 3,
        blunderChance: 1,
      });
      brain.setFleet([{ id: 1, size: 4 }]);
      brain.report({ x: 4, y: 4 }, hitOutcome(1));

      const shot = brain.nextShot();
      expect(shot.x === 4 || shot.y === 4).toBe(true);
    });

    it("extends a damaged ship at its ends instead of wandering off", () => {
      // Two aligned hits of a size-4 ship: placements covering both hits are
      // the only ones that count, so the best free cells are (1,5) and (4,5).
      const brain = new ProbabilityBrain({ size: 10, seed: 5 });
      brain.setFleet([{ id: 1, size: 4 }]);

      brain.report({ x: 2, y: 5 }, hitOutcome(1));
      brain.report({ x: 3, y: 5 }, hitOutcome(1));

      const shot = brain.nextShot();
      expect(shot.y).toBe(5);
      expect([1, 4]).toContain(shot.x);
    });
  });

  describe("learning from reports", () => {
    it("blocks the cells of a sunk ship for further placements", () => {
      const brain = new ProbabilityBrain({ size: 3, seed: 6 });
      brain.setFleet([
        { id: 1, size: 3 },
        { id: 2, size: 3 },
      ]);

      brain.report({ x: 0, y: 0 }, hitOutcome(1));
      brain.report({ x: 1, y: 0 }, hitOutcome(1));
      brain.report({ x: 2, y: 0 }, sunkOutcome(1));

      // row 0 is out of the game, only rows 1 and 2 can host the second ship
      const shot = brain.nextShot();
      expect(shot.y).toBeGreaterThan(0);
      expect(shot).not.toEqual({ x: 0, y: 0 });
      expect(shot).not.toEqual({ x: 1, y: 0 });
      expect(shot).not.toEqual({ x: 2, y: 0 });
    });

    it("retires the smallest ship when a sink references an unknown id", () => {
      const brain = new ProbabilityBrain({ size: 10, seed: 2 });
      brain.setFleet([
        { id: 1, size: 2 },
        { id: 2, size: 1 },
      ]);

      // desync: ship 9 does not exist in the injected fleet
      brain.report({ x: 5, y: 5 }, sunkOutcome(9));

      // the size-1 ship was retired; parity hunting stays on because the
      // size-2 ship is still alive

      for (let i = 0; i < 5; i++) {
        const shot = brain.nextShot();
        expect(inParity(shot)).toBe(true);
        brain.report(shot, MISS);
      }
    });
    it("keeps parity hunting while a size-1 ship is still alive", () => {
      // Regression: a size-1 ship covers no parity cell, so it must not
      // disable the parity filter while a ship of size >= 2 is alive. The old
      // `minAliveSize()`-based check switched parity off in this situation.
      const brain = new ProbabilityBrain({ size: 10, seed: 2 });
      brain.setFleet([
        { id: 1, size: 1 },
        { id: 2, size: 2 },
      ]);

      for (let i = 0; i < 5; i++) {
        const shot = brain.nextShot();
        expect(inParity(shot)).toBe(true);
        brain.report(shot, MISS);
      }
    });
  });

  describe("exhaustion", () => {
    it("throws once the whole board has been shot", () => {
      const brain = new ProbabilityBrain({ size: 3 });
      brain.setFleet([{ id: 1, size: 2 }]);

      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) brain.report({ x, y }, MISS);
      }

      expect(() => brain.nextShot()).toThrow(
        "ProbabilityBrain: no cells left to shoot",
      );
    });
  });

  describe("full game", () => {
    it.each([1, 7, 42])(
      "sinks the standard fleet without repeating a shot (seed %i)",
      (seed) => {
        const brain = new ProbabilityBrain({ size: 10, seed });
        brain.setFleet(FLEET);
        const board = new FakeEnemyBoard(LAYOUT);

        const shots: TCoordinate[] = [];
        while (!board.allSunk && shots.length < 100) {
          const shot = brain.nextShot();
          shots.push(shot);
          brain.report(shot, board.shoot(shot));
        }

        expect(board.allSunk).toBe(true);
        expect(new Set(shots.map(key)).size).toBe(shots.length);
        // Real fleet [5,4,3,3,2] = 17 cells, and every ship is >= 2 long, so
        // `hasParityTarget()` is true for the whole game and parity hunting
        // runs from the first shot. Uniform random shooting would need
        // E[max] = 17 * 101 / 18 ≈ 95.4 shots, which is exactly where the old
        // [4,3,3,2,2,2,1,1,1,1] fleet landed (96 / 95) because its size-1
        // ships kept parity disabled. The bound below therefore fails if
        // parity hunting regresses, without encoding a brittle exact number.
        expect(shots.length).toBeLessThanOrEqual(85);
      },
    );
  });
});
