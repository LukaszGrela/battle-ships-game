import type {
  TCellStatusMiss,
  TCellStatusShipDestroyed,
  TCellStatusShipHit,
  TCoordinate,
} from "@repo/types";

/**
 * Result of a legal shot fired through `WarRoom.attack()`.
 * The numeric status already encodes the ship id:
 *  - 0        -> miss
 *  - 100+id   -> hit on ship `id`
 *  - 1000+id  -> ship `id` destroyed
 */
export type TAttackOutcome =
  TCellStatusMiss | TCellStatusShipHit | TCellStatusShipDestroyed;

/**
 * Brain state as stored in a state snapshot. `state` is brain specific and
 * must stay JSON serializable (no class instances, no functions).
 */
export interface IBotBrainSnapshot {
  /** Brain implementation id, e.g. `"probability"`. */
  kind: string;
  /** Snapshot schema version of that brain implementation. */
  version: number;
  /** Brain specific payload. */
  state: unknown;
}

/**
 * Pure decision logic. Knows nothing about sockets or rooms.
 * It only ever learns what a real player could learn: outcomes of its own shots.
 */
export interface IBotBrain {
  /** Implementation id used to validate restored snapshots. */
  readonly kind: string;

  nextShot(): TCoordinate;
  report(shot: TCoordinate, outcome: TAttackOutcome): void;
  /**
   * Injects the fleet (ids + sizes) the bot has to sink.
   * Called at the beginning of every battle (placement phase) and whenever
   * a new battle starts (rematch) – the brain must reset its knowledge.
   */
  setFleet(ships: { id: number; size: number }[]): void;

  /** Full brain state, so a restart does not lose what the bot already knows. */
  serialize(): IBotBrainSnapshot;
  /**
   * Restores the brain in place from `serialize()` output.
   * Throws when the snapshot is malformed or belongs to another brain.
   */
  deserialize(snapshot: IBotBrainSnapshot): void;
}
