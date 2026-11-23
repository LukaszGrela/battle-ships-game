import {
  TCellStatusMiss,
  TCellStatusShipDestroyedOffset,
  TCellStatusShipHitOffset,
  type TCoordinate,
} from "@repo/types";
import { Mulberry32 } from "./random";
import {
  BotStateError,
  readArray,
  readInt,
  readNumber,
  readPRNGState,
  readRecord,
  readString,
} from "./serialization";
import type { IBotBrain, IBotBrainSnapshot, TAttackOutcome } from "./types";

const SNAPSHOT_VERSION = 1;

const UNKNOWN = 0;
const MISS = 1;
const HIT = 2;
const SUNK = 3;

const destroyedCellStatus: TCellStatusShipDestroyedOffset = 1000;
const hitCellStatus: TCellStatusShipHitOffset = 100;

export interface IProbabilityBrainOptions {
  /** Board size, must match `new BattleShips(10, AVAILABLE_SHIPS)` in WarRoom. */
  size?: number;
  seed?: number;
  /**
   * 0..1 – probability of ignoring the density map and firing a random cell.
   * 0 = strongest play ("hard"), ~0.15 = "medium", ~0.4 = "easy".
   */
  blunderChance?: number;
}

/**
 * Probability-density bot.
 *
 * For every still-alive enemy ship it enumerates all legal placements
 * (not overlapping misses/sunk ships) and sums them into a density map.
 * While there are unresolved hits it only counts placements that cover
 * at least one of them, weighted by the number of covered hits – this is
 * what makes it extend a damaged ship in line instead of wandering off.
 *
 * The brain never sees the opponent's board; it only receives outcomes
 * of its own shots via `report()`.
 */
export class ProbabilityBrain implements IBotBrain {
  readonly kind = "probability";

  private readonly n: number;
  private readonly rng: Mulberry32;
  /** Mutable: a restored brain keeps the blunder rate it had before the restart. */
  private blunderChance: number;
  private grid: Uint8Array;

  /** shipId -> size, for ships not yet sunk. */
  private aliveShips = new Map<number, number>();
  /** shipId -> cells of that ship already hit but not yet sunk. */
  private hitsByShip = new Map<number, TCoordinate[]>();

  constructor({
    size = 10,
    seed = 1,
    blunderChance = 0,
  }: IProbabilityBrainOptions = {}) {
    this.n = size;
    this.grid = new Uint8Array(size * size);
    this.rng = new Mulberry32(seed);
    this.blunderChance = blunderChance;
  }

  /**
   * Everything the brain learned so far plus its PRNG position, so a restored
   * bot keeps hunting the same ships and produces the same future shots.
   */
  serialize(): IBotBrainSnapshot {
    return {
      kind: this.kind,
      version: SNAPSHOT_VERSION,
      state: {
        size: this.n,
        blunderChance: this.blunderChance,
        rng: this.rng.state,
        // 0/1/2/3 per cell – base64 keeps a 10x10 board at 136 characters
        grid: Buffer.from(this.grid).toString("base64"),
        aliveShips: [...this.aliveShips.entries()],
        hitsByShip: [...this.hitsByShip.entries()].map(([shipId, cells]) => ({
          shipId,
          // [x, y] pairs – same shape as `aliveShips`, compact in JSON
          cells: cells.map(({ x, y }) => [x, y]),
        })),
      },
    };
  }

  deserialize(snapshot: IBotBrainSnapshot): void {
    const root = readRecord(snapshot, "brain");
    const kind = readString(root.kind, "brain.kind");
    if (kind !== this.kind) {
      throw new BotStateError(
        `brain.kind: expected "${this.kind}", received "${kind}"`,
      );
    }
    const version = readInt(root.version, "brain.version", 1);
    if (version !== SNAPSHOT_VERSION) {
      throw new BotStateError(`brain.version: unsupported version ${version}`);
    }

    const state = readRecord(root.state, "brain.state");
    const size = readInt(state.size, "brain.state.size", 2, 100);
    if (size !== this.n) {
      throw new BotStateError(
        `brain.state.size: expected ${this.n}, received ${size}`,
      );
    }

    const grid = Buffer.from(
      readString(state.grid, "brain.state.grid"),
      "base64",
    );
    if (grid.length !== size * size) {
      throw new BotStateError(
        `brain.state.grid: expected ${size * size} cells, received ${grid.length}`,
      );
    }
    for (const cell of grid) {
      if (cell > SUNK) {
        throw new BotStateError(`brain.state.grid: unknown cell value ${cell}`);
      }
    }

    const aliveShips = readArray(
      state.aliveShips,
      "brain.state.aliveShips",
      (entry, path) => {
        const pair = readArray(entry, path, (value, callPath) =>
          readInt(value, callPath, 0, 1000),
        );
        if (pair.length !== 2) {
          throw new BotStateError(`${path}: expected [shipId, size]`);
        }
        const [shipId, shipSize] = pair as [number, number];
        if (shipSize < 1) {
          throw new BotStateError(`${path}: ship size must be at least 1`);
        }

        return { shipId, shipSize };
      },
    );

    const hitsByShip = readArray(
      state.hitsByShip,
      "brain.state.hitsByShip",
      (entry, path) => {
        const record = readRecord(entry, path);
        const shipId = readInt(record.shipId, `${path}.shipId`, 0, 1000);
        const cells = readArray(
          record.cells,
          `${path}.cells`,
          (cell, cellPath) => {
            const coords = readArray(cell, cellPath, (value, valuePath) =>
              readInt(value, valuePath, 0, size - 1),
            );
            if (coords.length !== 2) {
              throw new BotStateError(`${cellPath}: expected [x, y]`);
            }

            return { x: coords[0] as number, y: coords[1] as number };
          },
        );

        return { shipId, cells };
      },
    );

    this.rng.restore(readPRNGState(state.rng, "brain.state.rng"));

    this.blunderChance = readNumber(
      state.blunderChance,
      "brain.state.blunderChance",
      0,
      1,
    );

    this.grid = new Uint8Array(grid);
    this.aliveShips = new Map(
      aliveShips.map(({ shipId, shipSize }) => [shipId, shipSize]),
    );
    this.hitsByShip = new Map(
      hitsByShip.map(({ shipId, cells }) => [shipId, cells]),
    );
  }

  /**
   * Fleet is known only once the placement phase starts, so it is injected
   * by `BotPlayer` from `TGameState.ships` (ids + sizes of `AVAILABLE_SHIPS`).
   */
  setFleet(ships: { id: number; size: number }[]): void {
    this.aliveShips = new Map(ships.map((ship) => [ship.id, ship.size]));
    this.hitsByShip = new Map(ships.map((ship) => [ship.id, []]));
    // new battle -> forget everything learned on the previous board
    this.grid = new Uint8Array(this.n * this.n);
  }

  report(shot: TCoordinate, outcome: TAttackOutcome): void {
    const idx = this.index(shot);

    if (outcome === (0 as TCellStatusMiss)) {
      this.grid[idx] = MISS;
      return;
    }

    if (outcome >= destroyedCellStatus) {
      // outcome 1001..1010 -> ship id 1..10
      const shipId = outcome - destroyedCellStatus;
      const cells = [...(this.hitsByShip.get(shipId) ?? []), shot];
      for (const cell of cells) {
        this.grid[this.index(cell)] = SUNK;
      }
      this.hitsByShip.delete(shipId);
      if (!this.aliveShips.delete(shipId)) {
        // desync fallback: retire the smallest remaining ship
        const smallest = [...this.aliveShips.entries()].sort(
          (a, b) => a[1] - b[1],
        )[0];
        if (smallest) this.aliveShips.delete(smallest[0]);
      }
      return;
    }

    // outcome 101..110 -> ship id 1..10
    const shipId = outcome - hitCellStatus;
    this.grid[idx] = HIT;
    const cells = this.hitsByShip.get(shipId) ?? [];
    cells.push(shot);
    this.hitsByShip.set(shipId, cells);
  }

  nextShot(): TCoordinate {
    const pendingHits = this.hasPendingHits();

    // Difficulty handicap: an occasional "human" random shot while hunting.
    if (!pendingHits && this.rng.next() < this.blunderChance) {
      const cell = this.pickRandomUnknown();
      if (cell) return cell;
    }

    const density = this.density();
    const parity = this.hasParityTarget() ? 2 : 1;

    // Hunting: prefer parity cells (every ship of size >= 2 covers one).
    // Fall back to any cell if the whole parity class is exhausted.
    const passes: boolean[] = pendingHits ? [false] : [true, false];
    for (const requireParity of passes) {
      let best = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < this.n * this.n; i++) {
        if (this.grid[i] !== UNKNOWN) continue;
        if (
          requireParity &&
          (Math.floor(i / this.n) + (i % this.n)) % parity !== 0
        ) {
          continue;
        }
        // jitter breaks ties deterministically for a given seed
        const score = (density[i] ?? 0) + this.rng.next() * 1e-3;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best >= 0) {
        return { x: best % this.n, y: Math.floor(best / this.n) };
      }
    }

    throw new Error("ProbabilityBrain: no cells left to shoot");
  }

  private hasPendingHits(): boolean {
    for (const cells of this.hitsByShip.values()) {
      if (cells.length > 0) return true;
    }
    return false;
  }

  /**
   * Parity hunting pays off only while a ship of size >= 2 is alive:
   * every such ship necessarily covers at least one cell with
   * (x + y) % 2 === 0. Ships of size 1 cover none, so they must not
   * disable the parity filter – they get caught by the second pass
   * (see the `[true, false]` fallback in `nextShot`).
   */
  private hasParityTarget(): boolean {
    for (const size of this.aliveShips.values()) {
      if (size >= 2) return true;
    }
    return false;
  }

  private pickRandomUnknown(): TCoordinate | undefined {
    const candidates: number[] = [];
    for (let i = 0; i < this.n * this.n; i++) {
      if (this.grid[i] === UNKNOWN) candidates.push(i);
    }
    if (candidates.length === 0) return undefined;
    const pick =
      candidates[Math.floor(this.rng.next() * candidates.length)] ?? 0;
    return { x: pick % this.n, y: Math.floor(pick / this.n) };
  }

  private density(): Float64Array {
    const { n, grid } = this;
    const density = new Float64Array(n * n);
    const restrictToHits = this.hasPendingHits();

    for (const length of this.aliveShips.values()) {
      for (const horizontal of [true, false]) {
        const dx = horizontal ? 1 : 0;
        const dy = horizontal ? 0 : 1;
        const maxX = horizontal ? n - length : n - 1;
        const maxY = horizontal ? n - 1 : n - length;

        for (let y = 0; y <= maxY; y++) {
          for (let x = 0; x <= maxX; x++) {
            let coveredHits = 0;
            let valid = true;

            for (let k = 0; k < length; k++) {
              const cell = grid[(y + dy * k) * n + (x + dx * k)];
              if (cell === MISS || cell === SUNK) {
                valid = false;
                break;
              }
              if (cell === HIT) coveredHits++;
            }

            if (!valid) continue;
            if (restrictToHits && coveredHits === 0) continue;

            // a placement resolving two hits in line is far more valuable
            const weight = 1 + coveredHits * coveredHits;

            for (let k = 0; k < length; k++) {
              const idx = (y + dy * k) * n + (x + dx * k);
              density[idx] = (density[idx] ?? 0) + weight;
            }
          }
        }
      }
    }

    return density;
  }

  private index({ x, y }: TCoordinate): number {
    return y * this.n + x;
  }
}
