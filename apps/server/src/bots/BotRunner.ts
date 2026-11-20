import type { IPlayer, TBotDifficulty } from "@repo/types";
import { getShortPirateName } from "../utils/getPirateyName";
import { BotPlayer, type IBotOptions } from "./BotPlayer";
import { ProbabilityBrain } from "./ProbabilityBrain";
import { WarRoom } from "../services/WarRoom";
import { createId } from "../utils/createId";

export interface TBotsConfig extends IBotOptions {
  difficulty: TBotDifficulty;
}

export const DEFAULT_BOTS_CONFIG: TBotsConfig = {
  difficulty: "hard",
  minDelayMs: 700,
  maxDelayMs: 1500,
  autoAcceptRematch: true,
};

const BLUNDER_CHANCE: Record<TBotDifficulty, number> = {
  easy: 0.4,
  medium: 0.15,
  hard: 0,
};

/** Per-difficulty pacing – slower bot looks more human. */
const DIFFICULTY_DELAYS: Record<
  TBotDifficulty,
  { minDelayMs: number; maxDelayMs: number }
> = {
  easy: { minDelayMs: 1200, maxDelayMs: 2500 },
  medium: { minDelayMs: 900, maxDelayMs: 1800 },
  hard: { minDelayMs: 700, maxDelayMs: 1500 },
};

export const BOT_DIFFICULTIES: TBotDifficulty[] = ["easy", "medium", "hard"];

/** Runtime guard for values coming from the socket layer. */
export const isBotDifficulty = (value: unknown): value is TBotDifficulty =>
  typeof value === "string" && (BOT_DIFFICULTIES as string[]).includes(value);

/**
 * Never let an unvalidated value reach `DIFFICULTY_DELAYS[...]` – an unknown
 * string would resolve to `undefined` and crash on `delays.minDelayMs`.
 */
export const normalizeBotDifficulty = (
  value: unknown,
  fallback: TBotDifficulty = DEFAULT_BOTS_CONFIG.difficulty,
): TBotDifficulty => (isBotDifficulty(value) ? value : fallback);

export const BOT_ID_PREFIX = "bot-";

export const isBotPlayerId = (playerId: string): boolean =>
  playerId.startsWith(BOT_ID_PREFIX);

export interface IBotRunnerHooks {
  /**
   * Called after the bot performed a state changing action
   * (placed ships / fired a shot / accepted a rematch).
   * The app layer uses it to broadcast the new room state.
   */
  onBotAction?: (roomId: string) => void;
}

/**
 * Owns every bot in the server process: one `BotPlayer` per room.
 *
 * The bot is a regular room player – it has no socket and no session, it is
 * driven by the server. `IPlayer.botLevel` marks it, so the client can render a
 * bot avatar instead of a human one.
 */
export class BotRunner {
  private bots = new Map<string, BotPlayer>();

  constructor(
    private readonly getRoom: (roomId: string) => WarRoom | undefined,
    private readonly config: TBotsConfig = DEFAULT_BOTS_CONFIG,
    private readonly hooks: IBotRunnerHooks = {},
  ) {}

  /**
   * Adds an AI player to a room and returns its `IPlayer`.
   * Must be called while the room is in `EGamePhase.Waiting`
   * (`BattleShips.addPlayer` refuses players in any later phase).
   */
  spawnBot(
    roomId: string,
    difficulty: TBotDifficulty = this.config.difficulty,
  ): IPlayer | undefined {
    const room = this.getRoom(roomId);
    if (!room) return undefined;
    if (this.bots.has(roomId)) {
      return room.getPlayer(this.bots.get(roomId)!.id);
    }

    const safeDifficulty = normalizeBotDifficulty(difficulty);
    const id = `${BOT_ID_PREFIX}${createId()}`;
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const player: IPlayer = {
      id,
      name: `AI ${getShortPirateName(seed)}`,
      seed,
      active: true,
      ready: false,
      botLevel: safeDifficulty,
    };

    if (!room.addPlayer(player)) return undefined;

    const delays = DIFFICULTY_DELAYS[safeDifficulty];
    const bot = new BotPlayer(
      room,
      id,
      new ProbabilityBrain({
        size: 10,
        seed,
        blunderChance: BLUNDER_CHANCE[safeDifficulty],
      }),
      {
        minDelayMs: delays.minDelayMs,
        maxDelayMs: delays.maxDelayMs,
        autoAcceptRematch: this.config.autoAcceptRematch,
        onAction: () => this.hooks.onBotAction?.(roomId),
      },
      seed,
    );
    this.bots.set(roomId, bot);
    bot.schedule();

    return player;
  }

  /** Id of the bot seated in the room (or `undefined` when there is none). */
  getBotId(roomId: string): string | undefined {
    return this.bots.get(roomId)?.id;
  }

  /** `IPlayer` of the bot seated in the room. */
  getBotPlayer(roomId: string): IPlayer | undefined {
    const botId = this.getBotId(roomId);
    if (!botId) return undefined;
    return this.getRoom(roomId)?.getPlayer(botId);
  }

  /** Single choke point: call after every room-state broadcast. */
  onRoomStateChanged(roomId: string): void {
    this.bots.get(roomId)?.schedule();
  }

  /** Call when the room is deleted / archived / left for good. */
  disposeBot(roomId: string): void {
    this.getRoom(roomId)?.removePlayer(this.getBotId(roomId) ?? "");
    this.bots.get(roomId)?.dispose();
    this.bots.delete(roomId);
  }

  disposeAll(): void {
    for (const bot of this.bots.values()) bot.dispose();
    this.bots.clear();
  }

  hasBot(roomId: string): boolean {
    return this.bots.has(roomId);
  }

  /** Room ids that currently host a bot. */
  get botRoomIds(): string[] {
    return Array.from(this.bots.keys());
  }
}
