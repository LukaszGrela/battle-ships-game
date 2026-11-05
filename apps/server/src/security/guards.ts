import type { IncomingMessage } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  createSessionAuthMiddleware,
  getSession,
  takeIssuedToken,
} from "./auth";
import {
  DEFAULT_SOCKET_RATE_LIMIT,
  IpLimiter,
  SocketRateLimiter,
  type IIpLimiterOptions,
  type ISocketRateLimitOptions,
} from "./rateLimit";

export interface ISocketSecurityLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

export type TTransport = "websocket" | "polling";

export interface ISocketSecurityOptions {
  /** Same secret used to sign the session token. */
  sessionSecret: string;
  /** Token lifetime, renewed on every successful connect. Default: 30 days. */
  sessionTtlSeconds?: number;
  /**
   * Browser origins allowed to open a socket. Checked in `allowRequest`, i.e. it
   * also covers the WebSocket upgrade, which CORS does not protect.
   * Requests without an Origin header (native clients, server-to-server) pass.
   */
  allowedOrigins?: (string | RegExp)[] | boolean;
  rateLimit?: Partial<ISocketRateLimitOptions>;
  ipLimit?: Partial<IIpLimiterOptions>;
  /** Concurrent sockets per IP. Opening 10k sockets is the cheapest flood there is. */
  maxConnectionsPerIp?: number;
  /** Bytes. Socket.IO's default is 1 MB - far more than a board-game move needs. */
  maxHttpBufferSize?: number;
  /** Transports you expose. Dropping "polling" kills a whole class of HTTP floods. */
  transports?: TTransport[];
  /**
   * Only enable when you run behind a proxy you control (nginx, Cloudflare, ALB).
   * Otherwise `x-forwarded-for` is client-controlled and the IP limit is useless.
   */
  trustProxy?: boolean;
  logger?: ISocketSecurityLogger;
}

const noopLogger: ISocketSecurityLogger = { warn: () => {} };

/** Log one line per N dropped packets, so logging itself can't be the amplifier. */
const LOG_EVERY_N_DROPS = 25;

function originAllowed(
  origin: string | undefined,
  allowed: (string | RegExp)[] | boolean | undefined,
): boolean {
  if (origin === undefined) return true; // non-browser client
  if (allowed === undefined || allowed === false) return false;
  if (allowed === true) return true;
  return allowed.some((rule) =>
    typeof rule === "string" ? rule === origin : rule.test(origin),
  );
}

function resolveIp(
  headers: IncomingMessage["headers"],
  remoteAddress: string | undefined,
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const forwarded = headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = first?.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return remoteAddress ?? "unknown";
}

/**
 * Builds the security layer.
 *
 * Half of the guards only exist as engine.io options, so they must be passed to
 * the `Server` constructor - hence `engineOptions` (spread into `new Server()`)
 * versus `install(io)` (middleware + listeners).
 */
export function createSocketSecurity(options: ISocketSecurityOptions) {
  const logger = options.logger ?? noopLogger;
  const trustProxy = options.trustProxy ?? false;

  const rateLimitOptions: ISocketRateLimitOptions = {
    ...DEFAULT_SOCKET_RATE_LIMIT,
    ...options.rateLimit,
  };
  const maxConnectionsPerIp = options.maxConnectionsPerIp ?? 5;

  const ipLimiter = new IpLimiter({
    capacity: 10,
    refillPerSecond: 0.5, // burst of 10, then ~30 handshakes/min
    denialsBeforeBan: 20,
    banMs: 60_000,
    idleTtlMs: 10 * 60_000,
    ...options.ipLimit,
  });

  const connectionsPerIp = new Map<string, number>();

  const engineOptions = {
    maxHttpBufferSize: options.maxHttpBufferSize ?? 64 * 1024,
    transports:
      options.transports ?? (["websocket", "polling"] as TTransport[]),
    // Compression of attacker-controlled input: zip-bomb + CPU burn for free.
    perMessageDeflate: false,

    allowRequest: (
      req: IncomingMessage,
      callback: (err: string | null, success: boolean) => void,
    ) => {
      const origin = req.headers.origin;
      if (!originAllowed(origin, options.allowedOrigins)) {
        logger.warn("socket.handshake.rejected.origin", { origin });
        callback("Origin not allowed", false);
        return;
      }

      const ip = resolveIp(req.headers, req.socket.remoteAddress, trustProxy);

      if ((connectionsPerIp.get(ip) ?? 0) >= maxConnectionsPerIp) {
        logger.warn("socket.handshake.rejected.connections", { ip });
        callback("Too many connections", false);
        return;
      }

      const verdict = ipLimiter.allow(ip);
      if (!verdict.allowed) {
        logger.warn("socket.handshake.rejected.rate", {
          ip,
          retryAfterMs: verdict.retryAfterMs,
        });
        callback("Rate limit exceeded", false);
        return;
      }

      callback(null, true);
    },
  };

  function install(io: Server): void {
    // 1. Authentication before `connection`: a rejected client never allocates a
    //    socket, a room membership or a reconnect-grace slot.
    io.use(
      createSessionAuthMiddleware(
        options.sessionSecret,
        options.sessionTtlSeconds,
      ),
    );

    io.on("connection", (socket: Socket) => {
      const ip = resolveIp(
        socket.handshake.headers,
        socket.handshake.address,
        trustProxy,
      );
      connectionsPerIp.set(ip, (connectionsPerIp.get(ip) ?? 0) + 1);

      const limiter = new SocketRateLimiter(rateLimitOptions);
      const { playerId } = getSession(socket);
      let dropped = 0;

      // Hand the (renewed) credential to the client. This listener is registered
      // before the game's `connection` handler, so the token always arrives
      // before `session_created` / `session_restored`.
      const issuedToken = takeIssuedToken(socket);
      if (issuedToken) socket.emit("session_token", issuedToken);

      // 2. Per-packet rate limiting. `socket.use` runs *before* your handlers and
      //    can drop a packet; `onAny` only observes, which is too late - the
      //    handler already ran.
      socket.use(([event], next) => {
        const verdict = limiter.consume(event);

        if (verdict.allowed) {
          next();
          return;
        }

        // Swallow the packet: no ack, no error reply, no handler. Replying (or
        // acking) would just hand the flooder an amplification channel.
        dropped += 1;
        const shouldDisconnect = limiter.registerViolation();

        if (shouldDisconnect) {
          logger.warn("socket.event.flood_disconnect", {
            socketId: socket.id,
            playerId,
            event,
            dropped,
          });
          socket.disconnect(true);
          return;
        }

        if (dropped % LOG_EVERY_N_DROPS === 0) {
          logger.warn("socket.event.rate_limited", {
            socketId: socket.id,
            playerId,
            event,
            scope: verdict.scope,
            dropped,
          });
        }
      });

      socket.on("disconnect", (reason) => {
        const remaining = (connectionsPerIp.get(ip) ?? 1) - 1;
        if (remaining <= 0) connectionsPerIp.delete(ip);
        else connectionsPerIp.set(ip, remaining);

        if (dropped > 0) {
          logger.warn("socket.disconnected", {
            socketId: socket.id,
            playerId,
            reason,
            dropped,
          });
        }
      });
    });
  }

  return {
    engineOptions,
    install,
    dispose: () => ipLimiter.dispose(),
    /** Snapshot for a /metrics endpoint - watch the rejected counters climbing. */
    stats: () => ({
      trackedIps: ipLimiter.size,
      connectedIps: connectionsPerIp.size,
    }),
  };
}
