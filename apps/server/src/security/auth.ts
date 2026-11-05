/**
 * Session tokens for Socket.IO.
 *
 * Rule of thumb: the client may tell you *which* session it thinks it is
 * (your persisted `clientId`), but it must never be able to prove it by itself.
 * Sign the identity server-side and verify the signature on every handshake, so
 * that replaying "playerId=abc" from another browser does not hijack a seat.
 *
 * Flow (no accounts, trust-on-first-use):
 *   1. First visit: client connects with no token -> server mints `playerId`
 *      (randomUUID) and a signed token, and sends the token via `session_token`.
 *   2. Client stores the token and sends it in `auth.token` on every reconnect.
 *   3. Server verifies the signature -> `socket.data.session.playerId` is trusted.
 *      A fresh (sliding-expiry) token is sent back on every successful connect.
 *
 * The token is the credential. `playerId` is just a label and may be shown to
 * other players; leaking it does not let anyone take the seat.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Socket } from "socket.io";

/** 30 days, renewed on every connect. */
export const DEFAULT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface ISessionPayload {
  /** Server-generated, safe to share with other players. */
  playerId: string;
  /** Issued at, seconds. */
  iat: number;
  /** Expiry, seconds. */
  exp: number;
}

const TOKEN_VERSION = "v1";

function hmac(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function signSession(
  payload: Pick<ISessionPayload, "playerId">,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: ISessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = hmac(`${TOKEN_VERSION}.${encoded}`, secret).toString(
    "base64url",
  );
  return `${TOKEN_VERSION}.${encoded}.${signature}`;
}

export function verifySession(
  token: string,
  secret: string,
): ISessionPayload | null {
  const [version, encoded, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !encoded || !signature) return null;

  const expected = hmac(`${TOKEN_VERSION}.${encoded}`, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as ISessionPayload;

    if (typeof payload.playerId !== "string" || payload.playerId.length === 0) {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function readToken(socket: Socket): string | null {
  const fromAuth = (socket.handshake.auth as { token?: unknown } | undefined)
    ?.token;
  if (typeof fromAuth === "string") return fromAuth;

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return null;
}

interface ISocketAuthData {
  session?: ISessionPayload;
  /** Freshly signed token the server must hand to the client (sliding expiry). */
  issuedToken?: string;
  /** True when no valid token was presented and a new identity was minted. */
  isNewPlayer?: boolean;
}

/**
 * Runs once per handshake, before `connection` fires.
 *
 * - valid token             -> same player, token renewed
 * - missing/invalid/expired -> brand-new player (never a *chosen* identity)
 *
 * The client can never pick its own `playerId`; the worst a forged or stale
 * token buys is a new empty identity. Abuse of this path (mass-minting) is
 * bounded by the per-IP handshake limiter in `allowRequest`.
 */
export function createSessionAuthMiddleware(
  secret: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = readToken(socket);
    const verified = token ? verifySession(token, secret) : null;

    const playerId = verified?.playerId ?? randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const session: ISessionPayload = verified ?? {
      playerId,
      iat: now,
      exp: now + ttlSeconds,
    };

    // Trusted for the rest of the connection: handlers read identity from here,
    // never from the payload.
    const data = socket.data as ISocketAuthData;
    data.session = session;
    data.isNewPlayer = !verified;
    data.issuedToken = signSession({ playerId }, secret, ttlSeconds);
    next();
  };
}

/** Read once by the security layer to deliver the token to the client. */
export function takeIssuedToken(socket: Socket): string | undefined {
  const data = socket.data as ISocketAuthData;
  const token = data.issuedToken;
  data.issuedToken = undefined; // don't keep a credential lying around
  return token;
}

export function getSession(socket: Socket): ISessionPayload {
  const session = (socket.data as { session?: ISessionPayload }).session;
  if (!session) {
    // Should be unreachable: the auth middleware runs first.
    throw new Error("socket has no session - auth middleware not installed?");
  }
  return session;
}
