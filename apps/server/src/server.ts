import { createServer } from "node:http";
import { Server } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { factoryConnectHandler } from "./socket";
import { expireDisconnectedPlayers } from "./utils/reconnectGrace";
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

export interface IGameServerOptions {
  instrumentAdminUi?: boolean;
  reconnectSweepIntervalMs?: number;
  /** Signs/verifies the Socket.IO session token. Defaults to SESSION_SECRET. */
  sessionSecret?: string;
  /** Browser origins allowed to connect. Fail-closed: defaults to the dev list. */
  allowedOrigins?: ISocketSecurityOptions["allowedOrigins"];
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
}

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://192.168.1.49:3000",
];

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
}: IGameServerOptions = {}) {
  const isProd = process.env.NODE_ENV === "production";

  let APP_VERSION: string = "";

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required by createGameServer()");
  }
  if (isProd && instrumentAdminUi) {
    throw new Error("Admin UI instrumentation must be disabled in production");
  }

  // Fail closed: a missing origin list is an empty list, never "*".
  const allowed = allowedOrigins ?? (isProd ? [] : DEV_ORIGINS);
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

  io.on("connection", factoryConnectHandler(io));

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
    close: async () => {
      clearInterval(reconnectSweep);
      security.dispose();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
    getVersion: async () => {
      if (!APP_VERSION) {
        APP_VERSION = await getVersion();
      }
      return APP_VERSION;
    },
  };
}
