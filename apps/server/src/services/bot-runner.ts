import type { Server } from "socket.io";
import type {
  IClientToServerEvents,
  IPlayer,
  IServerToClientEvents,
  TBotDifficulty,
} from "@repo/types";
import { BotRunner, DEFAULT_BOTS_CONFIG } from "../bots";
import ActiveGameRegistrySingleton from "./active-game-registry";
import ClientSessionServiceSingleton from "./client-session.service";

type TGameServer = Server<IClientToServerEvents, IServerToClientEvents>;

/**
 * Server side facade over the bot module.
 *
 * Responsibilities:
 *  - owns the single `BotRunner` instance of the process,
 *  - knows which rooms host a bot,
 *  - broadcasts the room state to the human players after every bot action
 *    (the bot has no socket, so it cannot emit anything by itself).
 *
 * The `io` reference is never captured eagerly:
 *  - `attach()` takes a *provider*, so every broadcast resolves the server that
 *    is alive at that moment (a closed server can never be emitted to),
 *  - `spawnBot()` may bind the room to the exact `io` that created it, which
 *    keeps two servers in one process (Vitest files) from cross-talking.
 */
export class BotRunnerService {
  private static instance: BotRunnerService | undefined;

  static getInstance(): BotRunnerService {
    if (!BotRunnerService.instance) {
      BotRunnerService.instance = new BotRunnerService();
    }
    return BotRunnerService.instance;
  }

  private readonly runner: BotRunner;
  /** Server owning the room, set on spawn when the caller passes `io`. */
  private readonly ioByRoom = new Map<string, TGameServer>();
  private ioProvider?: () => TGameServer | undefined;

  private constructor() {
    this.runner = new BotRunner(
      (roomId) => ActiveGameRegistrySingleton.getInstance().getRoom(roomId),
      DEFAULT_BOTS_CONFIG,
      {
        // The bot changed the room state -> push it to the human players.
        onBotAction: (roomId) => this.broadcastRoomState(roomId),
      },
    );
  }

  /**
   * Registers the `io` lookup of a server instance.
   *
   * @returns a disposer that clears the provider *only if it is still the
   * current one* - so closing an older server cannot detach a newer one.
   */
  attach(getIo: () => TGameServer | undefined): () => void {
    this.ioProvider = getIo;
    return () => {
      if (this.ioProvider === getIo) {
        this.ioProvider = undefined;
      }
    };
  }

  /**
   * Adds a bot to an open room.
   *
   * @param io server that owns the room - optional, but recommended: it pins
   * the room to this exact server so broadcasts never leak between instances.
   * @returns the bot player or `undefined` when the room is not available.
   */
  spawnBot(
    roomId: string,
    difficulty?: TBotDifficulty,
    io?: TGameServer,
  ): IPlayer | undefined {
    const bot = this.runner.spawnBot(roomId, difficulty);
    if (!bot) return undefined;

    if (io) this.ioByRoom.set(roomId, io);
    this.broadcastRoomState(roomId);
    return bot;
  }

  /** Removes the bot from the room (human left / room cleaned up). */
  removeBot(roomId: string): void {
    this.runner.disposeBot(roomId);
    this.ioByRoom.delete(roomId);
  }

  hasBot(roomId: string): boolean {
    return this.runner.hasBot(roomId);
  }

  getBotPlayer(roomId: string): IPlayer | undefined {
    return this.runner.getBotPlayer(roomId);
  }

  /** Choke point – call after every room state broadcast. */
  onRoomStateChanged(roomId: string): void {
    this.runner.onRoomStateChanged(roomId);
  }

  disposeAll(): void {
    this.runner.disposeAll();
    this.ioByRoom.clear();
  }

  /**
   * Sends the current game state to every human player of the room.
   * The bot itself has no socket and no session, so it is skipped.
   */
  broadcastRoomState(roomId: string): void {
    // Resolved per call: the room's own server wins, otherwise the provider of
    // the server that is currently running.
    const io = this.ioByRoom.get(roomId) ?? this.ioProvider?.();
    if (!io) return;

    const room = ActiveGameRegistrySingleton.getInstance().getRoom(roomId);
    if (!room) {
      this.ioByRoom.delete(roomId);
      return;
    }

    const sessions = ClientSessionServiceSingleton.getInstance();

    for (const player of room.getPlayers()) {
      if (player.botLevel) continue;

      const session = sessions.readSession(player.id);
      if (!session?.socketId) continue;

      io.to(session.socketId).emit(
        "game_updated",
        room.getGameState(player.id),
      );
    }
  }
}

export default BotRunnerService;
