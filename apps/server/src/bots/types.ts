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
 * Pure decision logic. Knows nothing about sockets, rooms or serialization.
 * It only ever learns what a real player could learn: outcomes of its own shots.
 */
export interface IBotBrain {
  nextShot(): TCoordinate;
  report(shot: TCoordinate, outcome: TAttackOutcome): void;
  /**
   * Injects the fleet (ids + sizes) the bot has to sink.
   * Called at the beginning of every battle (placement phase) and whenever
   * a new battle starts (rematch) – the brain must reset its knowledge.
   */
  setFleet(ships: { id: number; size: number }[]): void;
}
