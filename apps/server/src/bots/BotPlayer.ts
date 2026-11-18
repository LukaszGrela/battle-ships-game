import {
  EGamePhase,
  type TCellStatusShipId,
  type TGameState,
  type TShip,
} from "@repo/types";
import { generateFleetPlacement } from "./placement";
import { mulberry32 } from "./random";
import type { IBotBrain, TAttackOutcome } from "./types";
import { WarRoom } from "../services/WarRoom";

const BOARD_SIZE = 10; // WarRoom creates `new BattleShips(10, AVAILABLE_SHIPS)`
const MAX_PLACEMENT_ATTEMPTS = 5;
/** Fallback poll – the bot must not depend on a single broadcast to progress. */
const POLL_INTERVAL_MS = 300;

export interface IBotOptions {
  minDelayMs: number;
  maxDelayMs: number;
  /** Automatically accept a pending rematch requested by the loser. */
  autoAcceptRematch: boolean;
  /** Called after every state changing action the bot performs. */
  onAction?: () => void;
}

/**
 * Drives one bot inside one WarRoom.
 *
 * The bot has no socket and no ClientSession – it lives only in `BotRunner`.
 * It is woken up by `schedule()` (called from the room-state broadcast choke
 * point) and, as a safety net, by a low frequency poll – so a missed
 * broadcast can never freeze the game.
 * Every action re-reads the fresh game state before acting, so forfeits,
 * rematches and phase changes between the `setTimeout` and the callback are
 * handled safely.
 */
export class BotPlayer {
  private timer: NodeJS.Timeout | null = null;
  private poll: NodeJS.Timeout | null = null;
  private disposed = false;
  private placementAttempts = 0;
  private lastPhase: string | undefined;
  private readonly rng: () => number;

  constructor(
    private readonly room: WarRoom,
    readonly id: string,
    private readonly brain: IBotBrain,
    private readonly options: IBotOptions,
    seed: number,
  ) {
    this.rng = mulberry32(seed);
    this.startPoll();
  }

  /** Call after every state broadcast of the room. Idempotent. */
  schedule(): void {
    if (this.disposed) return;
    // A parked bot (finished room) wakes up on the next broadcast – that is
    // how a rematch request reaches it.
    this.setPolling(true);
    if (this.timer) return;
    // console.log(
    //   `[BotPlayer] schedule() for ${this.id} in room ${this.room.id}`,
    // );
    const delay =
      this.options.minDelayMs +
      this.rng() * (this.options.maxDelayMs - this.options.minDelayMs);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.fire();
    }, delay);
    this.timer.unref?.();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private startPoll(): void {
    if (this.disposed || this.poll) return;
    this.poll = setInterval(() => {
      if (this.disposed) return;
      this.schedule();
    }, POLL_INTERVAL_MS);
    this.poll.unref?.();
  }

  /**
   * The poll is only a safety net for a live game. A finished room has nothing
   * to do, so the interval is cleared instead of waking the bot every 300 ms
   * until the room is torn down.
   */
  private setPolling(active: boolean): void {
    if (this.disposed) return;
    if (active) {
      this.startPoll();
      return;
    }
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private fire(): void {
    if (this.disposed) return;

    // Re-read: state may have changed while the timer was pending.
    const state = this.room.getGameState(this.id);
    // console.log(
    //   `[BotPlayer] fire() for ${this.id} in room ${this.room.id}, phase=${state?.phase}, turn=${state?.turn}`,
    // );
    if (!state) return;

    // New battle (rematch) -> reset the placement budget and the brain.
    if (state.phase !== this.lastPhase) {
      if (state.phase === EGamePhase.Placement) {
        this.placementAttempts = 0;
      }
      this.lastPhase = state.phase;
    }

    if (state.phase === EGamePhase.Placement) {
      if (!state.self.ready) {
        this.placeFleet(state.ships);
      }
      return;
    }

    if (state.phase === EGamePhase.Playing) {
      if (state.turn === this.id) {
        this.shoot();
      }
      return;
    }

    if (state.phase === EGamePhase.Finished) {
      this.handleFinished(state);
      // Park the bot: no polling until a rematch broadcast wakes it up.
      this.setPolling(false);
    }
  }

  /**
   * Rematch handling – the loser asks, the winner answers:
   *  - the loser requested a rematch -> the bot (winner) accepts it,
   *  - the bot lost and nobody asked yet -> the bot asks for a rematch
   *    (the human, as the winner, accepts or rejects it).
   * The bot must never ask when it won: the winner only answers.
   */
  private handleFinished(state: TGameState): void {
    const request = state.rematchRequest;
    const result = state.result[this.id];

    if (request?.status === "pending" && request.requestorId !== this.id) {
      if (!this.options.autoAcceptRematch) return;
      // acceptRematch re-creates BattleShips and re-adds both players;
      // the next state broadcast puts the bot back into Placement.
      this.room.acceptRematch(this.id);
      this.options.onAction?.();
      return;
    }

    if (!request && result === "lost") {
      this.room.requestRematch(this.id);
      this.options.onAction?.();
    }
  }

  private placeFleet(ships: TShip[]): void {
    console.log(
      `[BotPlayer] placeFleet() for ${this.id} in room ${this.room.id}`,
      this.placementAttempts,
    );
    if (this.placementAttempts >= MAX_PLACEMENT_ATTEMPTS) {
      // give up quietly; the room sweep / opponent forfeit path takes over
      return;
    }
    this.placementAttempts++;

    const specs = ships.map((ship) => ({ id: ship.id, size: ship.size }));
    this.brain.setFleet(specs);

    // margin 1 = classic "no touching" placement, margin 0 = relaxed rules
    for (const margin of [1, 0] as const) {
      const placement = generateFleetPlacement(
        specs,
        BOARD_SIZE,
        this.rng,
        margin,
      );
      if (!placement) continue;

      const payload = ships.map((ship, i) => ({
        id: ship.id as TCellStatusShipId,
        size: ship.size,
        type: "pending" as const,
        placed: true as const,
        coords: placement[i]!.coords,
        orientation: placement[i]!.orientation,
      }));
      const success = this.room.placeShips(this.id, payload);
      console.log(
        `[BotPlayer] placeFleet() for ${this.id} in room ${this.room.id}, success=${success}`,
      );
      if (success) {
        this.options.onAction?.();
        return;
      }
    }
  }

  private shoot(): void {
    const shot = this.brain.nextShot();
    const result = this.room.attack(this.id, shot);
    console.log(
      `[BotPlayer] shoot() for ${this.id} in room ${this.room.id}, shot=${shot.x},${shot.y}, result=${result}`,
    );
    if (result === undefined || result < 0) {
      // error code (-1101 same cell, -1103 wrong turn, ...) – desync guard,
      // never guess: wait for the next state broadcast and re-evaluate
      return;
    }
    this.brain.report(shot, result as TAttackOutcome);
    this.options.onAction?.();
  }
}

export type { TGameState };
