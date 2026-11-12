# Battleship Game Server

This package contains the authoritative multiplayer game server for the Battleship project. It manages client sessions, room lifecycle, reconnect behavior, and the Socket.IO event flow used by the web client.




## Quick start

To run only the server:

```sh
pnpm --filter @repo/server dev
```
## Environment variables

The server expects a few environment variables when it starts. In local development, you can place them in an `.env` file inside `apps/server`.

```env
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-secret
PORT=3101
ALLOWED_ORIGINS=http://localhost:3100
```

Required values:

- `NODE_ENV` — set to `production` in deploys
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
- `accept_rematch`
- `reject_rematch`

If accepted, the same room is reset to a fresh placement phase without creating a brand-new room.

## Testing

Run the server tests:

```sh
pnpm --filter @repo/server test
```

## Notes

- There is no user login flow; a player identity is assigned on first connection and stored locally in the browser.
- The server remains the authority for room state; the client should never re-create a session during restore.
- Production deployments should treat `SESSION_SECRET` as a real secret and keep `ALLOWED_ORIGINS` restricted to the frontend origin.
