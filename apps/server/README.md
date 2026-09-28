# Battleships game server

This server is the authoritative state machine for multiplayer battleship matches. It owns the client session registry, room lifecycle, and socket-based game updates.

## Core model

### Sessions
The server keeps a persistent client session keyed by the client id (`clientId`). A session contains:

- `id`: stable client identity
- `socketId`: current live Socket.IO socket id
- `gameId`: current room id, if the client is in a room
- `disconnectedAt`: timestamp when the client disconnected while in a game
- `name` / `seed`: player identity data

This session is the source of truth for reconnects. Socket ids are ephemeral and can change when a user reconnects.

### Rooms
Each room is a game state object with a lifecycle phase:

- `waiting`
- `placement`
- `playing`
- `finished`

Room transitions are managed in `gameLifeCycle.ts`.

## Connection flow

When a socket connects, the server executes `factoryConnectHandler` from `src/socket/index.ts`.

1. Validate the `clientId` from `socket.handshake.auth.clientId`.
2. Register the handlers for room, game, and server events.
3. Look up the existing session by `clientId`.
4. If found:
   - update `socketId`
   - clear `disconnectedAt`
   - restore `gameId` if the room still exists
   - emit `session_restored`
5. If not found:
   - create a new session
   - emit `session_created`
6. Notify the client with `game_updated`:
   - if the session still belongs to a valid room, send the current game state
   - otherwise send `null`
7. Emit lobby data (`open_games`) and server stats.

This is the reconnect contract: the server decides whether the client is re-entering an active game, and it sends the correct state back.

## Reconnect grace policy

The server does not instantly forfeit a game on socket disconnect during play. Instead, the disconnect handler records `disconnectedAt` and keeps the room in the `playing` phase.

The reconnect timeout is configurable via:

- `GAME_RECONNECT_TIMEOUT_MS`

If it is not set, the default is `60_000` ms.

A cleanup task periodically checks sessions with a stale `disconnectedAt` value and forfeits the room if the timeout has elapsed.

This behavior is implemented in:

- `src/utils/reconnectGrace.ts`
- `src/socket/handlers/socket.handlers.impl/disconnect.ts`
- `src/socket/index.ts`

## Disconnect handling

The server treats disconnects in the following way:

- `playing`: mark the player as disconnected and keep the game alive for reconnect grace
- `placement`: if the room becomes single-player, tear it down; otherwise move back to `waiting`
- `waiting`: destroy the room and emit updated open games
- stale socket: ignore it safely when it does not match the current session socket id

The handler also re-emits room data using `emitRoomStateToPlayers` so all remaining players see the fresh state after a transition.

## Room lifecycle

The main lifecycle operations live in `src/utils/gameLifeCycle.ts`:

- `createWarRoom`
- `destroyWarRoom`
- `transitionToPlacement`
- `transitionToWaiting`
- `applyShipsAndMarkReady`
- `transitionToPlaying`
- `updateRoomWithNewTurnData`
- `transitionToFinished`

These functions manage the transitions between waiting, placement, playing, and finished states and update both the room and the session data consistently.

## Frontend contract

The frontend should not recreate the session during a restore. The server is responsible for restoring the session and emitting the correct room state.

The client should react to:

- `session_created`
- `session_restored`
- `game_updated`

The server emits `game_updated` as the authoritative response after reconnect, including `null` when the session no longer has a valid room.

## Important rule

Session data is the source of truth.

A reconnecting client must be matched by its stored session and not by a stale socket id from the previous connection.

That rule prevents the common bug where the frontend receives `null` or stale room data after reconnect because the server mistakenly broadcasts using the wrong socket target.
