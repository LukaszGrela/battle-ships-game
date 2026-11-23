/**
 * Small deterministic PRNG. Used instead of Math.random so that a bot
 * playing with a given `seed` is fully reproducible (replays, tests, bug reports).
 *
 * The generator keeps its whole position in a single 32 bit word, so it can be
 * saved and resumed without changing the sequence it produces. That is what
 * makes a bot survive a server restart with exactly the same future moves.
 */

/** Serialized position of a {@link Mulberry32} stream. */
export interface IPRNGState {
  /** Seed the stream was created with (kept for diagnostics / reproducibility). */
  seed: number;
  /** Current 32 bit cursor – resuming from it continues the same sequence. */
  cursor: number;
}

const isUint32 = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 0xffffffff;

export class Mulberry32 {
  #seed: number;

  #cursor: number;

  constructor(seed: number) {
    if (!isUint32(seed)) {
      throw new Error(`Invalid PRNG seed: ${String(seed)}`);
    }

    this.#seed = seed;
    this.#cursor = seed;
  }

  /** Seed the stream was created with (kept for diagnostics / reproducibility). */
  get seed(): number {
    return this.#seed;
  }

  /** Next pseudo random number in the `[0, 1)` range. */
  next(): number {
    this.#cursor = (this.#cursor + 0x6d2b79f5) >>> 0;
    let t = this.#cursor;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Current position, safe to store as JSON. */
  get state(): IPRNGState {
    return { seed: this.seed, cursor: this.#cursor };
  }

  /** Moves the stream to a previously saved position. */
  restore(state: IPRNGState): void {
    if (!state || !isUint32(state.cursor)) {
      throw new Error("Invalid PRNG state: cursor must be an uint32");
    }
    if (!isUint32(state.seed)) {
      throw new Error("Invalid PRNG state: seed must be an uint32");
    }

    // The sequence depends only on the cursor, but restoring the recorded seed
    // keeps `state` a faithful round-trip of what was saved.
    this.#seed = state.seed;
    this.#cursor = state.cursor;
  }

  /** Rebuilds a generator from a saved position. */
  static from(state: IPRNGState): Mulberry32 {
    const rng = new Mulberry32(state?.seed);
    rng.restore(state);

    return rng;
  }
}

export function mulberry32(seed: number): () => number {
  const rng = new Mulberry32(seed);

  return () => rng.next();
}
