# Socket.IO hardening checklist

Ordered by how much damage the gap causes, not by how easy it is to implement.

## 1. Handshake (engine.io, before any socket exists)

- [x] `allowRequest` — origin allowlist **and** per-IP handshake rate limit + ban.
      This is the only hook that also sees the raw WebSocket upgrade; a `cors` config
      alone leaves WS connections wide open (CORS is a browser rule, `ws` clients ignore it).
- [x] `maxHttpBufferSize: 64 * 1024` — one 900 KB packet is already a memory problem.
- [x] `perMessageDeflate: false` — compression + attacker input = zip bomb / CPU burn.
- [x] `maxConnectionsPerIp` — 10k idle sockets is a DoS that sends zero events.
- [ ] `transports: ["websocket"]` once polling is not needed — kills HTTP floods.
- [ ] Reverse proxy limits (`limit_conn`, `limit_req`, body size) in front of Node.

## 2. Authentication (`io.use`)

- [x] Signed session token (HMAC), verified on handshake; identity lives in `socket.data`.
- [ ] Never trust `playerId` / `clientId` from the event payload — only from `socket.data`.
- [ ] Re-check authorization per event (`is it this player's turn? do they own the ship?`).
      Rate limiting is not authorization: 3 legitimate-looking but forged moves per second
      still break the game.
- [ ] Short TTL + refresh (reconnect grace already gives you the reconnect window).

## 3. Per-socket rate limiting (`socket.use`)

- [x] Global token bucket (all events) + per-event-type bucket (spam one event only).
- [x] Violation budget → `socket.disconnect(true)` instead of choking on packets forever.
- [x] Packets dropped silently — no ack, no error reply (replies are amplification).
- [x] Sampled logging (every 25th drop) so logging can't become the bottleneck.
- [ ] Per-IP event limiting for the multi-socket case (one player, 50 tabs).
- [ ] Cost-weighted buckets for expensive events (`create:lobby`, pathfinding, serialization).

## 4. Payload & state

- [ ] Validate every payload (`zod` / `valibot`) before it reaches game logic.
- [ ] Validate against your own state, not just the shape: turn order, room membership,
      phase (`can't attack during lobby`), and existing entity ids.
- [ ] Do not echo attacker-controlled strings back to other players without escaping
      (chat, player names) — that is XSS in the other players' browsers.

## 5. Operational

- [x] Admin UI (`auth: false`) only outside production, hard failure in prod.
- [ ] Admin UI uses `auth: false` = anyone who can reach the port can write to your game state.
      In staging, use `auth` with `bcrypt` + `session` secret, or keep the port unexposed.
- [ ] Structured logs with `socketId` / `playerId` / `event` so a flood is diagnosable.
- [ ] Metrics: handshake rejects, dropped packets, disconnects by reason.
- [ ] Counters are per-process. With >1 instance, move buckets to Redis
      (`rate-limiter-flexible`) or each pod allows the full budget.

## Redis-backed variant (multi-instance)

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

Note the async cost: every inbound event now waits on Redis. Keep the in-memory
bucket as a first cheap gate and only hit Redis when it trips.
