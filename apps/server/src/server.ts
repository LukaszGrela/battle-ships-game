import { createServer } from "node:http";
import { Server } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { factoryConnectHandler } from "./socket";
import {
  expireDisconnectedPlayers,
  disposeRestartGrace,
} from "./utils/reconnectGrace";
import {
  createSocketSecurity,
  type ISocketSecurityLogger,
  type ISocketSecurityOptions,
} from "./security/guards";
import type {
  IIpLimiterOptions,
  ISocketRateLimitOptions,
} from "./security/rateLimit";
import { getVersion } from "./utils/version";
import { isProd } from "./utils/isProd";
import { BotRunnerService as BotRunnerServiceSingleton } from "./bots";
import { disposeRoomLifecycle } from "./utils/roomLifecycle";
import { disposeRematchTimeouts } from "./utils/rematchTimeout";
import {
  StateService,
  announceServerRestart,
  buildRestartNoticeForReason,
  createStateHttpHandler,
  type IRestoreReport,
} from "./services/state";
import {
  AUTOSAVE_INTERVAL_MS,
  getStateDir,
  getStateSaveToken,
  isStatePersistenceEnabled,
} from "./config/state";

export interface IGameServerOptions {
  instrumentAdminUi?: boolean;
  reconnectSweepIntervalMs?: number;
  /** Signs/verifies the Socket.IO session token. Defaults to SESSION_SECRET. */
  sessionSecret?: string;
  /** Browser origins allowed to connect. Fail-closed: defaults to the dev list. */
  allowedOrigins?: Exclude<ISocketSecurityOptions["allowedOrigins"], boolean>;
  maxConnectionsPerIp?: number;
  /**
   * Per-socket token bucket overrides. Tests widen these: one E2E run fires far
   * more events than a real player, and a dropped packet that requested an ack
   * never answers, so an under-sized bucket shows up as a 60s hang.
   */
  rateLimit?: Partial<ISocketRateLimitOptions>;
  /** Per-IP handshake limiter overrides. Tests share 127.0.0.1. */
  ipLimit?: Partial<IIpLimiterOptions>;
  /** Enable only behind a proxy you control (nginx / Cloudflare / ALB). */
  trustProxy?: boolean;
  logger?: ISocketSecurityLogger;
  /**
   * Snapshot directory. Defaults to `STATE_DIR` / `~/.battle-ships-game/state`,
   * deliberately outside the repository. Pass `false` to disable persistence for
   * this server instance (the test suite does).
   */
  stateDir?: string | false;
  /** Overrides `STATE_SAVE_TOKEN`; without a token the admin route is not mounted. */
  saveStateToken?: string;
}

const DEV_ORIGINS = ["http://localhost:3100", "http://localhost:3102"];

/** admin.socket.io is a real browser origin: it needs CORS *and* the engine check. */
const ADMIN_ORIGIN = "https://admin.socket.io";

export function createGameServer({
  instrumentAdminUi = true,
  reconnectSweepIntervalMs = 5_000,
  sessionSecret = process.env.SESSION_SECRET,
  allowedOrigins,
  maxConnectionsPerIp,
  rateLimit,
  ipLimit,
  trustProxy,
  logger,
  stateDir,
  saveStateToken,
}: IGameServerOptions = {}) {
  let APP_VERSION: string = "";

  const readVersion = async (): Promise<string> => {
    if (!APP_VERSION) {
      APP_VERSION = await getVersion();
    }
    return APP_VERSION;
  };

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required by createGameServer()");
  }
  if (isProd() && instrumentAdminUi) {
    throw new Error("Admin UI instrumentation must be disabled in production");
  }

  // Fail closed: a missing origin list is an empty list, never "*". Boolean `true` is removed from allowedOrigins type, so the engine-level check never allows all origins. The dev list is always allowed, so a local dev server can connect to a prod server without changing the prod config.
  const allowed = (allowedOrigins ?? []).concat(isProd() ? [] : DEV_ORIGINS);
  const origins: (string | RegExp)[] = [
    ...(Array.isArray(allowed) ? allowed : []),
    ...(instrumentAdminUi ? [ADMIN_ORIGIN] : []),
  ];

  const security = createSocketSecurity({
    sessionSecret,
    // Engine-level origin check: also covers the WebSocket upgrade, where CORS
    // does nothing at all. The `cors` block below only guards the polling XHR.
    allowedOrigins: allowed,
    maxConnectionsPerIp,
    rateLimit,
    ipLimit,
    trustProxy,
    logger,
  });

  const httpServer = createServer();

  const io = new Server<IClientToServerEvents, IServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: origins,
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Payload cap, no permessage-deflate, origin + per-IP handshake limits.
      // All of it runs before any application code.
      ...security.engineOptions,
    },
  );

  // Installed first, so auth + rate limiting precede every game handler.
  security.install(io);

  const stateEnabled =
    stateDir !== false &&
    (stateDir !== undefined || isStatePersistenceEnabled());
  const stateService = stateEnabled
    ? new StateService({
        dir: typeof stateDir === "string" ? stateDir : getStateDir(),
      })
    : undefined;
  const stateSaveToken = saveStateToken ?? getStateSaveToken();

  // Restoring happens before the first connection is handled: a client that
  // reconnects immediately must find its room, its session and its gameId
  // already in place, otherwise `welcome` would drop it into a fresh lobby.
  const ready: Promise<IRestoreReport> = (async () => {
    if (!stateService) {
      return {
        restored: false,
        rooms: [],
        closedRooms: [],
        sessions: 0,
        gameStats: 0,
        bots: 0,
        reason: "disabled",
      };
    }

    try {
      const report = await stateService.restore(io);
      console.info(
        `[state] restore: ${report.rooms.length} room(s), ${report.sessions} session(s), ${report.gameStats} result(s), ${report.bots} bot(s)`,
        report.closedRooms.length
          ? `closed: ${report.closedRooms.map((room) => `${room.name} (${room.reason})`).join(", ")}`
          : "",
        report.reason ?? "",
      );
      return report;
    } catch (error) {
      console.error("[state] restore failed:", error);
      return {
        restored: false,
        rooms: [],
        closedRooms: [],
        sessions: 0,
        gameStats: 0,
        bots: 0,
        reason: "restore-failed",
      };
    }
  })();

  // Holding the handshake until the snapshot is applied keeps the restore
  // atomic from the client's point of view.
  io.use((_socket, next) => {
    ready.then(
      () => next(),
      () => next(),
    );
  });

  io.on("connection", factoryConnectHandler(io));

  const handleHttpRequest = createStateHttpHandler({
    enabled: Boolean(stateService),
    saveToken: stateSaveToken,
    getVersion: readVersion,
    getSocketCount: () => io.engine?.clientsCount ?? 0,
    save: async () => {
      if (!stateService) {
        throw new Error("state persistence is disabled");
      }
      return stateService.save();
    },
    /**
     * Reached from `ExecStop` (see `scripts/notify-restart.sh`), so the players
     * are warned even when the SIGTERM never lands or the supervisor kills the
     * cgroup outright.
     */
    announceRestart: async (reason) => {
      await announceServerRestart(io, buildRestartNoticeForReason(reason));
    },
  });

  httpServer.on("request", (req, res) => {
    void handleHttpRequest(req, res);
  });

  // Crash recovery: the periodic snapshot bounds what an unexpected exit can
  // cost. It starts only after the restore finished, so a slow restore cannot
  // be overwritten by an empty in-memory state. `StateService.save()`
  // serializes the writes, and a failed save must not stop the interval.
  let autosave: NodeJS.Timeout | undefined;
  if (stateService) {
    const autosaveService = stateService;
    void ready.then(() => {
      autosave = setInterval(() => {
        autosaveService.save().catch((error) => {
          console.error("[state] autosave failed:", error);
        });
      }, AUTOSAVE_INTERVAL_MS);
      autosave.unref();
    });
  }

  // Bots resolve their `io` lazily through this provider, so a closed server is
  // never emitted to and parallel test servers do not cross-talk.
  let liveIo: typeof io = io;
  const detachBotRunner = BotRunnerServiceSingleton.getInstance().attach(
    () => liveIo,
  );

  const reconnectSweep = setInterval(() => {
    expireDisconnectedPlayers(io);
  }, reconnectSweepIntervalMs);
  reconnectSweep.unref();

  if (instrumentAdminUi) {
    import("@socket.io/admin-ui")
      .then(({ instrument }) => {
        instrument(io, {
          // `auth: false` means no credentials at all on the admin namespace.
          auth: false,
          mode: "development",
        });
      })
      .catch((err) => {
        console.error("Failed to load @socket.io/admin-ui:", err);
      });
  }

  return {
    httpServer,
    io,
    /** Resolves once the previous snapshot has been applied (or skipped). */
    ready,
    /** Snapshot location, `undefined` when persistence is off. */
    stateFilePath: stateService?.filePath,
    /** Writes a snapshot now. Used by the shutdown hook and the admin route. */
    saveState: async () => {
      if (!stateService) {
        throw new Error("state persistence is disabled");
      }
      return stateService.save();
    },
    close: async () => {
      clearInterval(reconnectSweep);
      if (autosave) clearInterval(autosave);
      security.dispose();

      // Bots hold timers (unref'd, but they still mutate room state).
      BotRunnerServiceSingleton.getInstance().disposeAll();
      // Finished-room TTL and rematch timers would otherwise fire against a
      // closed io.
      disposeRoomLifecycle();
      disposeRematchTimeouts();
      disposeRestartGrace();
      detachBotRunner();
      liveIo = undefined as unknown as typeof io;

      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
    getVersion: readVersion,
  };
}
