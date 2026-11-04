import { describe, expect, it, vi } from "vitest";
import { signSession, verifySession } from "../auth";
import {
  DEFAULT_SOCKET_RATE_LIMIT,
  IpLimiter,
  SocketRateLimiter,
  TokenBucket,
} from "../rateLimit";

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then rejects", () => {
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 0 });
    expect([bucket.tryRemove(), bucket.tryRemove(), bucket.tryRemove()]).toEqual([
      true,
      true,
      true,
    ]);
    expect(bucket.tryRemove()).toBe(false);
  });

  it("refills over time", () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1 });
    bucket.tryRemove();
    bucket.tryRemove();
    expect(bucket.tryRemove()).toBe(false);

    vi.advanceTimersByTime(2_000);
    expect(bucket.tryRemove()).toBe(true);
    vi.useRealTimers();
  });
});

describe("SocketRateLimiter", () => {
  const options = { ...DEFAULT_SOCKET_RATE_LIMIT, burst: 5, perSecond: 0, eventBurst: 2, eventPerSecond: 0 };

  it("trips the per-event bucket when one event is spammed", () => {
    const limiter = new SocketRateLimiter(options);
    expect(limiter.consume("game:move").allowed).toBe(true);
    expect(limiter.consume("game:move").allowed).toBe(true);

    const verdict = limiter.consume("game:move");
    expect(verdict).toMatchObject({ allowed: false, scope: "event" });
  });

  it("still accepts other event types after one is throttled", () => {
    const limiter = new SocketRateLimiter(options);
    limiter.consume("game:move");
    limiter.consume("game:move");
    limiter.consume("game:move"); // throttled

    expect(limiter.consume("chat:send").allowed).toBe(true);
  });

  it("trips the global bucket on a mixed-event flood", () => {
    const limiter = new SocketRateLimiter(options);
    for (let i = 0; i < 5; i += 1) limiter.consume(`event:${i}`);

    expect(limiter.consume("event:other")).toMatchObject({ allowed: false, scope: "global" });
  });

  it("reports a disconnect only after the violation budget is spent", () => {
    const limiter = new SocketRateLimiter({
      ...options,
      maxViolationsBeforeDisconnect: 3,
    });

    expect(limiter.registerViolation()).toBe(false);
    expect(limiter.registerViolation()).toBe(false);
    expect(limiter.registerViolation()).toBe(true);
  });
});

describe("IpLimiter", () => {
  it("bans an IP after repeated denials", () => {
    const limiter = new IpLimiter({
      capacity: 1,
      refillPerSecond: 0,
      denialsBeforeBan: 2,
      banMs: 60_000,
      idleTtlMs: 60_000,
    });

    expect(limiter.allow("1.2.3.4").allowed).toBe(true);
    expect(limiter.allow("1.2.3.4").allowed).toBe(false); // denial 1
    expect(limiter.allow("1.2.3.4").allowed).toBe(false); // denial 2 -> ban
    expect(limiter.allow("1.2.3.4").retryAfterMs).toBeGreaterThan(0);

    limiter.dispose();
  });
});

describe("session tokens", () => {
  const secret = "test-secret";

  it("round-trips a valid payload", () => {
    const token = signSession({ playerId: "p1", clientId: "c1" }, secret, 60);
    expect(verifySession(token, secret)).toMatchObject({ playerId: "p1", clientId: "c1" });
  });

  it("rejects a tampered payload", () => {
    const token = signSession({ playerId: "p1" }, secret, 60);
    const [version, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ playerId: "admin", iat: 0, exp: 9e9 })).toString(
      "base64url",
    );
    expect(verifySession(`${version}.${forged}.${signature}`, secret)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signSession({ playerId: "p1" }, "other-secret", 60);
    expect(verifySession(token, secret)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession({ playerId: "p1" }, secret, -1);
    expect(verifySession(token, secret)).toBeNull();
  });
});
