# Socket.IO security layer

Reference for the guards in `security/`, the `SESSION_SECRET` runbook, the
client-token migration and the open backlog.

**Status:** implemented but **not executed**. `vitest` and `tsc` have never been
run against this code (see [Testing](#testing)). Treat every number below as a
starting point, not a measured value.

---

## Contents

- [The four choke points](#the-four-choke-points)
- [Files](#files)
- [`SESSION_SECRET`](#session_secret)
- [The session token](#the-session-token)
- [Client-side changes](#client-side-changes)
- [Guard reference](#guard-reference)
- [Tuning knobs](#tuning-knobs)
- [Required before merge](#required-before-merge)
- [Backlog](#backlog)
- [Redis-backed variant](#redis-backed-variant)
- [Testing](#testing)

---

## The four choke points

A socket flood can arrive in four different ways, and each one needs its own
guard. They are listed in the order a connection passes through them:

| # | Layer | Hook | What it stops |
|---|---|---|---|
| 1 | Handshake | engine.io `allowRequest` | Connection floods, cross-site WS hijacking, idle-socket floods |
| 2 | Authentication | `io.use` | Forged / stolen identities, seat hijacking |
| 3 | Per-packet | `socket.use` | Event floods, single-event spam, unknown-event probes |
| 4 | Payload | `maxHttpBufferSize`, no deflate | Memory bombs, zip bombs |

Two traps that are easy to get wrong:

- **`cors` does not protect a WebSocket.** CORS is a browser rule; a `ws://`
  client ignores it. The only hook that sees the raw upgrade is `allowRequest`.
- **`socket.onAny` cannot block a packet.** By the time it fires, the handler
  has already run. `socket.use` is the one that can drop it — by *not* calling
  `next()`.

---

## Files

| File | Role |
|---|---|
| `security/guards.ts` | `createSocketSecurity()` → `{ engineOptions, install, dispose, stats }`. Wires everything together. |
| `security/auth.ts` | HMAC session tokens, `createSessionAuthMiddleware`, `getSession`, `takeIssuedToken`. |
| `security/rateLimit.ts` | `TokenBucket`, `SocketRateLimiter`, `IpLimiter`. All in-memory. |
| `security/__tests__/security.test.ts` | Vitest specs (written, never run). |
| `server.ts` | Creates the server, fails fast, installs the security layer. |
| `socket/index.ts` | The `connection` handler — reads identity from `socket.data`, not from the handshake. |
| `../../socket/getClientId.ts` (client) | Stores/reads the session token. |

The split in `guards.ts` is deliberate: `maxHttpBufferSize`,
`perMessageDeflate`, `transports` and `allowRequest` only exist as
**engine.io** options, so they must be spread into the `Server` constructor.
Middleware and listeners go in via `install(io)`.

```ts
const security = createSocketSecurity({ sessionSecret, allowedOrigins });

const io = new Server<IClientToServerEvents, IServerToClientEvents>(httpServer, {
  cors: { origin: corsOrigin, methods: ["GET", "POST"], credentials: true },
  ...security.engineOptions,   // allowRequest, size cap, no deflate
});

security.install(io);          // io.use(auth) + socket.use(rate limit)
io.on("connection", factoryConnectHandler(io));  // registered after
```

---

## `SESSION_SECRET`

### What it is

The HMAC key that signs session tokens. In the current code it appears in
exactly one place — `server.ts`:

```ts
sessionSecret = process.env.SESSION_SECRET,
```

It is fed into `createSessionAuthMiddleware(options.sessionSecret, ...)` in
`guards.ts`, and from there into `signSession` / `verifySession` in `auth.ts`,
which use it as the key for `createHmac("sha256", secret)`.

Without it, `createGameServer()` throws at startup:

```ts
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required by createGameServer()");
}
```

### Who owns it

**The server operator.** Concretely:

- It belongs to the **server process**, not to any player. Players never see
  it; they only hold the *token* it signs.
- It is **shared by every instance** of the backend. Two replicas of the same
  game = one secret, not two.
- It is **not** the admin UI credential. The admin UI currently runs
  `auth: false`, so it has no secret at all — that is a separate hole, see the
  [backlog](#backlog). If admin auth is enabled, that is a second, separately
  owned secret.

### Who sets it up

The operator, once per environment, outside the code. Nothing in the repo
should generate it — a code-generated secret changes on every restart and
silently invalidates every player's session.

**1. Generate it (once, on your machine):**

```bash
openssl rand -base64 32
# or
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

**2. Put it in the environment where the server process starts:**

| Environment | Where |
|---|---|
| Local dev | `.env` in the server package root + `import "dotenv/config"` at the top of the entry file |
| Docker | `environment:` in compose, or `--env-file` |
| Railway / Render / Fly / Heroku | Project settings → Environment variables (mark it secret) |
| Kubernetes | `Secret` mounted as an env var — not baked into the image |

**3. Commit only the template, never the value:**

```bash
# .gitignore
.env
.env.local

# .env.example
SESSION_SECRET=
```

Then `cp .env.example .env` and paste the generated value in.

### Rules that actually matter

- **Same value across restarts and replicas.** If a restart changes it, every
  existing token fails verification → every client is silently re-minted as a
  new player and loses their session and game. If two instances sit behind a
  load balancer, they must read the same secret or players will ping-pong
  between identities.
- **Never `VITE_`-prefix it.** The client uses `import.meta.env`. Anything
  prefixed `VITE_` gets inlined into the JavaScript bundle and is readable by
  anyone who opens devtools. The secret belongs in the server's `process.env`
  only.
- **Length matters.** The current check is only "non-empty", so
  `SESSION_SECRET=secret` passes and makes the tokens forgeable by anyone who
  guesses it. 32 random bytes is the floor. A minimum-length startup check is
  in the [backlog](#backlog).
- **Rotation is a hard cut.** There is no key-id or previous-key support in
  `auth.ts`, so changing the secret invalidates every outstanding token — all
  players get fresh identities. That is the intended failure mode for a leak,
  but plan it as a deliberate maintenance action.

### If it leaks

Rotate it and treat every currently-issued token as compromised. Since
`playerId` is the only thing the token grants, that means open games and
connected seats are exposed — so also clear the in-memory session/room state
you do not want a forged client walking into.

---

## The session token

The old design used a client-generated UUID (`localStorage`) as the identity.
That is safe only while the id never leaves the browser. The connect handler
emits `welcome` with the id and sends room state around, so the id can leak
into other players' browsers — and anyone holding it could connect with
`auth: { clientId }` and take that seat.

The token design separates the two:

- **The token is the credential.** It is signed by the server, so a client
  cannot prove an identity it was not given.
- **`playerId` is just a label.** It may be shown to other players; leaking it
  does not let anyone take the seat.

### Format

```
v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256("v1." + payload, secret))>
```

Payload: `{ playerId, iat, exp }` (seconds).

### Flow

1. **First visit:** the client connects with no token. The server mints
   `playerId = randomUUID()`, signs a token, and sends it in the
   `session_token` event.
2. **Reconnect:** the client sends `auth.token`. The server verifies the
   signature with `timingSafeEqual` (after a length check), so
   `socket.data.session.playerId` is trusted.
3. **Every successful connect:** a fresh token is issued, so the 30-day expiry
   slides forward.
4. **Missing, forged or expired token:** the client gets a **fresh empty
   identity** — never a chosen one. It is never rejected outright; a stale
   token must not lock a player out of the lobby.

The token is read from `handshake.auth.token` or from an
`Authorization: Bearer <token>` header.

### Server-side API (`security/auth.ts`)

| Export | Purpose |
|---|---|
| `signSession({ playerId }, secret, ttlSeconds)` | Issues a token. |
| `verifySession(token, secret)` | Returns the payload or `null`. Checks version, presence, signature, non-empty `playerId`, `exp > now`. |
| `createSessionAuthMiddleware(secret, ttlSeconds?)` | The `io.use` middleware. Sets `socket.data.session`, `socket.data.isNewPlayer`, `socket.data.issuedToken`. |
| `getSession(socket)` | Reads `socket.data.session`. Throws if the middleware is not installed. |
| `takeIssuedToken(socket)` | Hands the freshly signed token to the caller and clears it from `socket.data`. |
| `DEFAULT_SESSION_TTL_SECONDS` | 30 days. |

---

## Client-side changes

| Before | After |
|---|---|
| `localStorage["battleships-game:client-id"]` = client-generated UUID | `localStorage["battleships-game:session-token"]` = server-signed token |
| `auth: { clientId: getClientId() }` | `auth: (cb) => cb({ token: getSessionToken() })` |
| — | `socket.on("session_token", setSessionToken)` |

- The `auth` option must be a **function**: it is evaluated on every connection
  attempt, so a reconnect always sends the most recent (renewed) token. A
  static object would keep replaying the token from page load.
- The legacy `battleships-game:client-id` key is removed on load.
- `getClientId.ts` still exists as a filename but no longer generates anything.
  It exports `getSessionToken`, `setSessionToken`, `clearSessionToken`.

**Migration cost:** every existing browser gets a new identity once, because
the old `clientId` is no longer accepted. Their old in-memory session and game
are orphaned. Migrating them would reopen the exact hole this closes, so it
was not done.

---

## Guard reference

### 1. Handshake (engine.io, before any socket exists)

- **Origin allowlist** — checked in `allowRequest`, so it also covers the
  WebSocket upgrade. A request without an `Origin` header (native client,
  server-to-server) passes. `allowedOrigins: undefined` or `false` denies
  everything.
- **Per-IP handshake rate limit** — token bucket, burst 10, refill 0.5/s
  (≈30 handshakes/min sustained). After 20 denials the IP is banned for 60s.
  A ban resets the bucket, so the IP starts clean when it comes back.
- **Max concurrent sockets per IP** — default 5. Opening 10k idle sockets is
  the cheapest DoS there is and emits zero events. Counted on `connection`,
  decremented on `disconnect`.
- **Idle-IP sweep** — the IP map forgets addresses idle for 10 minutes, so it
  cannot grow forever.
- **`maxHttpBufferSize: 64 * 1024`** — Socket.IO's default is 1 MB, which is
  already a memory problem for a single packet.
- **`perMessageDeflate: false`** — compression of attacker-controlled input is
  a free zip bomb / CPU burn.

### 2. Authentication (`io.use`)

Runs once per handshake, before `connection` fires. A client that gets this
far has a socket but no room membership and no reconnect-grace slot yet.

### 3. Per-socket rate limiting (`socket.use`)

- **Global bucket** — all inbound events.
- **Per-event bucket** — catches "spam only `game:move`" without starving
  other events.
- **Unknown events** — dropped with scope `"unknown"` once `knownEvents` is
  configured. Without that list, Socket.IO happily accepts any event name and
  each new name would get its own bucket, so the map is hard-capped
  (`maxTrackedEventTypes`, default 32) and overflow names share one bucket.
- **Violation budget** — 20 drops in a 10s window → `socket.disconnect(true)`,
  which closes the transport and the namespace, not just the packet.
- **Silent drops** — no ack, no error reply, no handler. Replying would hand
  the flooder an amplification channel.
- **Sampled logging** — one line per 25th drop, so logging cannot become the
  bottleneck.

### 4. Fail-fast in `server.ts`

- Throws without `SESSION_SECRET`.
- Throws if `instrumentAdminUi` is on and `NODE_ENV=production`.
- Origins fail closed: production defaults to `[]` (no browser origin), dev
  defaults to `localhost:3000`, `:4173`, `:5173`.
- CORS and the engine-level origin check are built from **the same list**. They
  used to disagree, which meant the admin UI passed CORS and was then rejected
  at the handshake — fixed.

---

## Tuning knobs

All of these are defaults; override them through `createSocketSecurity(...)`.

| Option | Default | Effect |
|---|---|---|
| `maxConnectionsPerIp` | `5` | Concurrent sockets per IP |
| `maxHttpBufferSize` | `65536` | Max packet size in bytes |
| `transports` | `["websocket", "polling"]` | Drop `"polling"` to kill HTTP floods |
| `trustProxy` | `false` | Read `x-forwarded-for` — **only** behind a proxy you control |
| `sessionTtlSeconds` | `2592000` (30d) | Token lifetime, renewed on each connect |
| `knownEvents` | `[]` | Client→server event allowlist (see backlog) |
| `rateLimit.burst` | `40` | Global event burst |
| `rateLimit.perSecond` | `10` | Global sustained rate |
| `rateLimit.eventBurst` | `12` | Per-event burst |
| `rateLimit.eventPerSecond` | `4` | Per-event sustained rate |
| `rateLimit.maxViolationsBeforeDisconnect` | `20` | Drops before the socket is kicked |
| `rateLimit.violationWindowMs` | `10000` | Violation window |
| `rateLimit.maxTrackedEventTypes` | `32` | Hard cap on tracked event names |
| `ipLimit.capacity` | `10` | Handshake burst per IP |
| `ipLimit.refillPerSecond` | `0.5` | Handshake sustained rate per IP |
| `ipLimit.denialsBeforeBan` | `20` | Denials before the ban |
| `ipLimit.banMs` | `60000` | Ban duration |
| `ipLimit.idleTtlMs` | `600000` | Idle-IP eviction |

The event defaults are tuned for a turn-based board game: ~10 events/s
sustained is far above normal play, ~4/s per event type is generous even for a
client that batches moves.

---

## Required before merge

These block a correct deployment:

- [ ] **Add `session_token` to `IServerToClientEvents`** in `@repo/types`.
      Without it the client `socket.on("session_token", ...)` does not compile
      and the token never reaches the browser.

      ```ts
      // IServerToClientEvents
      session_token: (token: string) => void;
      ```

- [ ] **Run `vitest` and `tsc`.** Neither has been executed against this code.

- [ ] **Verify the admin UI still connects** in dev, after the origin-list fix.

---

## Backlog

Ordered by how much damage the gap causes.

### Known events (partially done)

- [x] `guards.ts` accepts a `knownEvents` list and passes it to the limiter.
- [ ] **Supply the list.** Until it is set, unknown-event rejection is inert
      (the limiter stays permissive and only the map cap protects you).

      ```ts
      const CLIENT_EVENTS = [
        "game:move",
        // ...every event in IClientToServerEvents
      ] as const satisfies readonly (keyof IClientToServerEvents)[];

      createSocketSecurity({ sessionSecret, knownEvents: CLIENT_EVENTS });
      ```

      Keep it in sync with `IClientToServerEvents` — a stale list silently
      drops legitimate events.

### Authorization and payloads

- [ ] Never trust `playerId` from an event payload — only from
      `socket.data.session`.
- [ ] Re-check authorization per event (`is it this player's turn? do they own
      that ship? is the phase right?`). Rate limiting is not authorization:
      3 legitimate-looking but forged moves per second still break the game.
- [ ] Validate every payload (`zod` / `valibot`) before it reaches game logic.
- [ ] Validate against your own state, not just the shape: turn order, room
      membership, phase, existing entity ids.
- [ ] Do not echo attacker-controlled strings back to other players without
      escaping (chat, player names) — that is XSS in the other players'
      browsers.

### Operational gaps found while reviewing this code

- [ ] **`io.emit("open_games", ...)` runs on every connect.** A reconnect flood
      turns into a broadcast to everyone. Send it with `socket.emit` on
      connect and broadcast only when the list actually changes.
- [ ] **`emitStats(io)` has the same problem** — it is called on every
      connection and broadcasts.
- [ ] **Reconnect backoff is too aggressive for the new ban.** The client uses
      `reconnectionDelayMax: 2_000` with `reconnectionAttempts: Infinity`; on a
      flaky network that can trip the 60s per-IP ban and then keep hammering
      it. Raise the max delay to ~5–10s.
- [ ] **Two tabs share one token.** The second tab overwrites
      `existing.socketId`, so the first tab is orphaned but not disconnected.
      Kick the older socket explicitly.
- [ ] **Admin UI runs `auth: false`** — anyone who can reach the port can
      mutate game state. In staging use `auth` with `bcrypt` + a `session`
      secret, or keep the port unexposed.
- [ ] **Structured logs** with `socketId` / `playerId` / `event`, so a flood is
      diagnosable. The logger interface is already there
      (`ISocketSecurityLogger`).
- [ ] **Metrics**: handshake rejects, dropped packets, disconnects by reason.
      `security.stats()` returns `{ trackedIps, connectedIps }` as a starting
      point.
- [ ] **Minimum secret length.** Add a startup check rejecting a
      `SESSION_SECRET` shorter than 32 characters.
- [ ] **`SESSION_SECRET_PREVIOUS` support** for rotation without logging
      everyone out: verify against the old key, re-sign with the new one, drop
      the old key once the old tokens have expired.
- [ ] **Reverse-proxy limits** (`limit_conn`, `limit_req`, body size) in front
      of Node.
- [ ] **`transports: ["websocket"]`** on the server once polling is not needed —
      kills a whole class of HTTP floods. The client already requests
      websocket only.
- [ ] **Per-IP event limiting** for the multi-socket case (one player, 50
      tabs).
- [ ] **Cost-weighted buckets** for expensive events (`create:lobby`,
      pathfinding, serialization).

### Scale

- [ ] **Counters are per-process.** With more than one instance the effective
      limit is `limit * instanceCount`, because each instance keeps its own
      counters. Move the buckets to Redis (below) before scaling out.

---

## Redis-backed variant

```ts
import { RateLimiterRedis } from "rate-limiter-flexible";

const limiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl:events",
  points: 40,          // = burst
  duration: 4,         // seconds; points/duration = sustained rate
  blockDuration: 10,   // 10s of silence after the budget is blown
});

socket.use(async ([event], next) => {
  try {
    await limiter.consume(`${playerId}:${event}`);
    next();
  } catch {
    next(); // consume() already rejected the packet; do not run the handler
  }
});
```

Note the async cost: every inbound event now waits on Redis. Keep the
in-memory bucket as a cheap first gate and only hit Redis when it trips.

---

## Testing

`security/__tests__/security.test.ts` covers:

- `TokenBucket` — burst limit and refill over time.
- `SocketRateLimiter` — per-event bucket trips, other event types stay open,
  global bucket trips on a mixed flood, violation budget reports a disconnect.
- `IpLimiter` — ban after repeated denials, `retryAfterMs` reported.
- Session tokens — round-trip, tampered payload, wrong secret, expired token.

**Not covered:** the middleware path end-to-end (minting, renewal, delivery
of `session_token`), `allowRequest` behaviour, the `socket.use` drop path, and
the origin allowlist.

**Not verified:** these specs have never been executed, and neither has `tsc`.
Expect to fix type errors. Nothing in this document is based on a measured
result.
