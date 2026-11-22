# Battleship Game Server

This package contains the authoritative multiplayer game server for the Battleship project. It manages client sessions, room lifecycle, reconnect behavior, and the Socket.IO event flow used by the web client.

## Quick start

To run only the server:

```sh
pnpm --filter @repo/server dev
```

## Environment variables

The server expects a few environment variables when it starts (`via process.env.*`). In local development, you can place them in an `.env` file inside `apps/server`.

```env
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-secret
PORT=3101
ALLOWED_ORIGINS=http://localhost:3100
```

- `NODE_ENV` — set to `production` for deploys, set to `development` for dev work.
- `SESSION_SECRET` — secret used to sign session tokens and validate reconnect identity
- `PORT` — optional, defaults to `3101`
- `ALLOWED_ORIGINS` — comma-separated list of allowed origins in production

The server also exposes a lightweight health endpoint:

```sh
curl http://localhost:3101/health
```

## Core server behavior

### Sessions

The server keeps a stable client session keyed by a client identifier. A session stores:

- `id` — stable client identity
- `socketId` — active socket connection
- `gameId` — current active room, when present
- `disconnectedAt` — reconnect grace timestamp while a player is away
- `name` and `seed` — local player identity metadata

This is the source of truth for reconnects. Socket IDs are treated as ephemeral and may change between connections.

### Room lifecycle

Rooms move through these phases:

- `waiting`
- `placement`
- `playing`
- `finished`

The lifecycle is handled in the server utilities and service layer, with room transitions enforcing the rules for ready states, turn updates, disconnect handling, and finished-game reconciliation.

A room that reaches `finished` is not deleted immediately: `scheduleFinishedRoomCleanup` keeps it alive for `FINISHED_ROOM_TTL_MS` (5 minutes) so the final state can be read and a rematch can be started. Teardown happens in `closeGameRoom`, which cancels the pending timer, disposes the bot, records the battle if it was not recorded yet, and only then removes the room from the registry.

### Reconnect flow

When a client connects, the server:

1. validates its connection identity
2. restores the prior session if one exists
3. refreshes the live socket ID
4. reattaches the player to the same game when the room still exists
5. emits the latest `game_updated` room state or `null` when no game is active

This prevents stale socket references and keeps reconnects stable.

### Disconnect policy

If a player disconnects while playing, the server keeps the room alive for a reconnect grace period instead of immediately forfeiting the match. If there is no reconnect within the configured timeout, the room is cleaned up according to the internal game lifecycle rules.

### Rematch flow

When a game ends, the losing player may request a rematch. The winner can accept or reject it:

- `request_rematch`
- `cancel_rematch`
- `accept_rematch`
- `reject_rematch`

If accepted, the same room is reset to a fresh placement phase without creating a brand-new room.

### Bots

A room can be filled by a server-side bot instead of a waiting human.

- `create_game_with_bot` creates a room with the bot already seated; `bot_opponent` seats a bot in an existing room.
- difficulties are `easy`, `medium` and `hard` (`TBotDifficulty`); the value is validated at runtime and an unknown difficulty is rejected instead of stored.
- the bot is a normal `IPlayer` with `botLevel` set, so it is broadcast and rendered like any other player.
- bot ids use the `bot-` prefix and are unique per room; a room with a bot is no longer listed in `open_games`, and bots are excluded from per-player statistics aggregation.
- `BotRunnerService` owns the bot lifecycle (`spawnBot`, `removeBot`, `onRoomStateChanged`, `disposeAll`). The bot is re-armed by room state changes and is disposed together with its room.
- a bot acts through the same room API as a human (`room.attack`), so it cannot bypass turn or board rules.

### Game statistics

`src/services/game-stats.service.ts` is an append-only store of finished battles, deliberately independent from `ActiveGameRegistry`: rooms are deleted, lifetime numbers must not be.

`src/utils/recordFinishedGame.ts` builds the record from the finished room (`WarRoom.getFinishedBattleSummary()` → `BattleShips.getFinishSummary()`) and stores it under the idempotency key `<roomId>#<battleIndex>`.

Recording is triggered from two idempotent places:

1. `emitRoomStateToPlayers` after a `finished` broadcast (the normal path, followed by a `server_stats` emit),
2. `closeGameRoom` in `roomLifecycle.ts` as a last chance before the room is deleted, which covers endings whose broadcast never reached the choke point.

A record contains `id`, `roomId`, `roomName`, `battleIndex`, `finishedAt`, `byForfeit`, `players[]` (`id`, `name`, `botLevel?`, `result: "win" | "lost"`) and a free-form `meta` bag for additional game data.

Service methods: `recordGame`, `hasGame`, `playedGames`, `playedGamesByForfeit`, `recentGames(limit)`, `getGame`, `playerStats`, `allPlayerStats`, `size`, `reset` (tests only). `playedGames()` feeds `TStats.playedGames` through `emitStats`.

The store is in memory, so statistics reset on server restart. Moving to a database means implementing `IGameStatsService` and keeping `GameStatsServiceSingleton`.

## Testing

Run the server tests:

```sh
pnpm --filter @repo/server test
```

The suite includes the socket flow end-to-end (`src/main.e2e.test.ts`), the bot lifecycle (`src/bots/BotRunner.e2e.test.ts`), room rules (`src/services/WarRoom.test.ts`) and the statistics store (`src/services/game-stats.service.test.ts`).

## Notes

- There is no user login flow; a player identity is assigned on first connection and stored locally in the browser.
- The server remains the authority for room state; the client should never re-create a session during restore.
- Production deployments should treat `SESSION_SECRET` as a real secret and keep `ALLOWED_ORIGINS` restricted to the frontend origin.
- Statistics are held in process memory; restarting the server resets `playedGames` and per-player aggregates.
