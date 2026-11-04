/**
 * Session tokens for Socket.IO.
 *
 * Rule of thumb: the client may tell you *which* session it thinks it is
 * (your persisted `clientId`), but it must never be able to prove it by itself.
 * Sign the identity server-side and verify the signature on every handshake, so
 * that replaying "playerId=abc" from another browser does not hijack a seat.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Socket } from "socket.io";

export interface ISessionPayload {
  playerId: string;
  /** Client-generated id, kept only as a reconnect hint. Never an auth factor. */
  clientId?: string;
  /** Issued at, seconds. */
  iat: number;
  /** Expiry, seconds. */
  exp: number;
}

const TOKEN_VERSION = "v1";

function hmac(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

/** Call this after you resolved/created the player on your side (HTTP route or first handshake). */
export function signSession(
  payload: Pick<ISessionPayload, "playerId" | "clientId">,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: ISessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = hmac(`${TOKEN_VERSION}.${encoded}`, secret).toString("base64url");
  return `${TOKEN_VERSION}.${encoded}.${signature}`;
}

export function verifySession(token: string, secret: string): ISessionPayload | null {
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
  const fromAuth = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === "string") return fromAuth;

  const header = socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return null;
}

/**
 * Runs once per handshake, before `connection` fires: a rejected client never
 * gets a socket, a room, or a reconnect-grace slot.
 */
export function createSessionAuthMiddleware(secret: string) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = readToken(socket);
    const session = token ? verifySession(token, secret) : null;

    if (!session) {
      // The client receives only the message; attach a code if you want detail.
      const error = new Error("UNAUTHORIZED") as Error & { data?: unknown };
      error.data = { code: "UNAUTHORIZED" };
      next(error);
      return;
    }

    // Trusted for the rest of the connection: handlers read identity from here,
    // never from the payload.
    (socket.data as { session?: ISessionPayload }).session = session;
    next();
  };
}

export function getSession(socket: Socket): ISessionPayload {
  const session = (socket.data as { session?: ISessionPayload }).session;
  if (!session) {
    // Should be unreachable: the auth middleware runs first.
    throw new Error("socket has no session - auth middleware not installed?");
  }
  return session;
}
