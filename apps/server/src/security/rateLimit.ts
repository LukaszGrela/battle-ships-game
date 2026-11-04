/**
 * Token-bucket rate limiting for the Socket.IO layer.
 *
 * Everything here is IN-MEMORY and PER-PROCESS. With more than one Node instance
 * the effective limit is `limit * instanceCount`, because each instance keeps its
 * own counters. Scaling out means moving the buckets to Redis behind the same
 * interfaces (see security/README.md).
 */

export interface ITokenBucketOptions {
  /** Maximum burst. */
  capacity: number;
  /** Sustained refill rate. */
  refillPerSecond: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillAt = Date.now();

  constructor(private readonly options: ITokenBucketOptions) {
    this.tokens = options.capacity;
  }

  /** Consumes `cost` tokens. Returns false when the caller is over budget. */
  tryRemove(cost = 1): boolean {
    this.refill();
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  /** How long until one token is available again. */
  get retryAfterMs(): number {
    this.refill();
    const missing = 1 - this.tokens;
    if (missing <= 0) return 0;
    if (this.options.refillPerSecond <= 0) return Number.MAX_SAFE_INTEGER;
    return Math.ceil((missing / this.options.refillPerSecond) * 1000);
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    this.lastRefillAt = now;
  }
}

export interface ISocketRateLimitOptions {
  /** All inbound events, burst. */
  burst: number;
  /** All inbound events, sustained rate. */
  perSecond: number;
  /** One event type, burst. Stops "spam one event" without blocking the others. */
  eventBurst: number;
  /** One event type, sustained rate. */
  eventPerSecond: number;
  /** Drops within `violationWindowMs` before the socket gets kicked. */
  maxViolationsBeforeDisconnect: number;
  violationWindowMs: number;
  /** Safety valve when no event allowlist is supplied. */
  maxTrackedEventTypes: number;
}

/**
 * Tuned for a turn-based board game: ~10 events/s sustained is far above normal
 * play, ~4/s per event type is generous even for a client that batches moves.
 * Raise `burst` if you have chatty ticks; lower everything for a twitch game.
 */
export const DEFAULT_SOCKET_RATE_LIMIT: ISocketRateLimitOptions = {
  burst: 40,
  perSecond: 10,
  eventBurst: 12,
  eventPerSecond: 4,
  maxViolationsBeforeDisconnect: 20,
  violationWindowMs: 10_000,
  maxTrackedEventTypes: 32,
};

export type TRateLimitScope = "global" | "event" | "unknown";

export type TRateLimitVerdict =
  | { allowed: true }
  | { allowed: false; scope: TRateLimitScope; retryAfterMs: number };

const ALLOWED: TRateLimitVerdict = { allowed: true };

export class SocketRateLimiter {
  private readonly global: TokenBucket;
  private readonly perEvent = new Map<string, TokenBucket>();
  private readonly known: Set<string>;
  /** Bucket for event names outside `known` / beyond the map cap. */
  private readonly overflow: TokenBucket;
  private violations: number[] = [];

  constructor(
    private readonly options: ISocketRateLimitOptions = DEFAULT_SOCKET_RATE_LIMIT,
    /**
     * Names you actually handle. Socket.IO does not reject unknown events, so
     * without this list a client can invent 100k event names; each would get its
     * own fresh bucket and grow this map. Keep it in sync with
     * `IClientToServerEvents` (a typed `const` array is enough).
     */
    knownEvents: readonly string[] = [],
  ) {
    this.global = new TokenBucket({
      capacity: options.burst,
      refillPerSecond: options.perSecond,
    });
    this.overflow = new TokenBucket({
      capacity: options.eventBurst,
      refillPerSecond: options.eventPerSecond,
    });
    this.known = new Set(knownEvents);
  }

  consume(event: string): TRateLimitVerdict {
    if (!this.global.tryRemove()) {
      return {
        allowed: false,
        scope: "global",
        retryAfterMs: Math.max(this.global.retryAfterMs, 250),
      };
    }

    // An event name you never registered is either a bug or a probe: drop it
    // outright rather than paying for a handler lookup.
    if (this.known.size > 0 && !this.known.has(event)) {
      return { allowed: false, scope: "unknown", retryAfterMs: 0 };
    }

    const bucket = this.bucketFor(event);
    if (!bucket.tryRemove()) {
      return {
        allowed: false,
        scope: "event",
        retryAfterMs: Math.max(bucket.retryAfterMs, 100),
      };
    }

    return ALLOWED;
  }

  /** Records a drop. Returns true when the socket should be disconnected. */
  registerViolation(): boolean {
    const now = Date.now();
    this.violations = this.violations.filter(
      (at) => now - at < this.options.violationWindowMs,
    );
    this.violations.push(now);
    return this.violations.length >= this.options.maxViolationsBeforeDisconnect;
  }

  private bucketFor(event: string): TokenBucket {
    const existing = this.perEvent.get(event);
    if (existing) return existing;

    // Hard cap on tracked names even when a caller passes an allowlist that is
    // long enough, or passes none at all.
    if (this.perEvent.size >= this.options.maxTrackedEventTypes) {
      return this.overflow;
    }

    const bucket = new TokenBucket({
      capacity: this.options.eventBurst,
      refillPerSecond: this.options.eventPerSecond,
    });
    this.perEvent.set(event, bucket);
    return bucket;
  }
}

export interface IIpLimiterOptions {
  /** Handshakes allowed in a burst from one IP. */
  capacity: number;
  /** Sustained handshake rate for one IP. */
  refillPerSecond: number;
  /** Blocked attempts before the IP is banned. */
  denialsBeforeBan: number;
  /** How long the ban lasts. */
  banMs: number;
  /** Forget IPs idle for this long, so the map cannot grow forever. */
  idleTtlMs: number;
}

interface IIpEntry {
  bucket: TokenBucket;
  denials: number;
  bannedUntil: number;
  lastSeenAt: number;
}

/**
 * Limits connection attempts per IP. Used from engine.io `allowRequest`, i.e.
 * before a socket object, room membership or session state is ever allocated.
 */
export class IpLimiter {
  private readonly entries = new Map<string, IIpEntry>();
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(private readonly options: IIpLimiterOptions) {
    this.sweepTimer = setInterval(
      () => this.sweep(),
      Math.max(Math.floor(this.options.idleTtlMs / 2), 10_000),
    );
    this.sweepTimer.unref();
  }

  /** Synchronous on purpose: `allowRequest` must answer immediately. */
  allow(ip: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.entryFor(ip);
    entry.lastSeenAt = now;

    if (entry.bannedUntil > now) {
      return { allowed: false, retryAfterMs: entry.bannedUntil - now };
    }
    if (entry.bannedUntil > 0) {
      // Ban expired: start from a clean bucket instead of the drained one.
      entry.bannedUntil = 0;
      entry.bucket = this.newBucket();
    }

    if (entry.bucket.tryRemove()) {
      entry.denials = 0;
      return { allowed: true, retryAfterMs: 0 };
    }

    entry.denials += 1;
    if (entry.denials >= this.options.denialsBeforeBan) {
      entry.bannedUntil = now + this.options.banMs;
      entry.denials = 0;
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(entry.bucket.retryAfterMs, 1_000),
    };
  }

  get size(): number {
    return this.entries.size;
  }

  dispose(): void {
    clearInterval(this.sweepTimer);
    this.entries.clear();
  }

  private newBucket(): TokenBucket {
    return new TokenBucket({
      capacity: this.options.capacity,
      refillPerSecond: this.options.refillPerSecond,
    });
  }

  private entryFor(ip: string): IIpEntry {
    let entry = this.entries.get(ip);
    if (!entry) {
      entry = {
        bucket: this.newBucket(),
        denials: 0,
        bannedUntil: 0,
        lastSeenAt: Date.now(),
      };
      this.entries.set(ip, entry);
    }
    return entry;
  }

  private sweep(): void {
    const now = Date.now();
    const cutoff = now - this.options.idleTtlMs;
    for (const [ip, entry] of this.entries) {
      if (entry.lastSeenAt < cutoff && entry.bannedUntil < now) {
        this.entries.delete(ip);
      }
    }
  }
}
