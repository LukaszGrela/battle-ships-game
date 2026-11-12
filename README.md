# Battle-Ships Game

A one-on-one battle-ships game built as a TypeScript monorepo with a Socket.IO game server and a React/Vite web client.

## Repository overview

The monorepo is organized as follows:

- `apps/server` — authoritative server and socket handlers
- `apps/web` — React + Vite client
- `packages/game-logic` — shared board and gameplay rules
- `packages/types` — shared TypeScript contracts for event payloads and runtime state

## Tech stack

- TypeScript
- Socket.IO
- Vite + React for the client
- Vitest for tests
- Turbo for workspace orchestration
- pnpm workspaces

## Requirements

- Node.js 24+
- pnpm 11+

## Runtime setup

Install dependencies from the repository root:

```sh
pnpm install
```

Run the whole app locally:

```sh
pnpm dev
```

This starts:

- web app: http://localhost:3100
- server: http://localhost:3101

## Useful commands

```sh
pnpm build
pnpm lint
pnpm test
```

## Server behavior summary

The server owns the session registry and room lifecycle. It keeps the client session as the source of truth, and socket IDs are treated as ephemeral values that may change on reconnect.

Key rules:

- `clientId` identifies the player across reconnects.
- `socketId` is refreshed whenever the client reconnects.
- `gameId` is restored only when the room still exists.
- `game_updated` is emitted with the real room state or `null` when there is no active room.
- stale disconnects from playing game maintain a reconnect grace period before a room is forfeited.

## Player identity

There is no login functionality, each player has token assigned at first connection which is then stored on users machine. This token identifies players machine only, it stores player id with a seed number. The seed is used to pick player's avatar and pick piratey name. There is only 48 avatars so it may happen that 2 opponents has the same avatar.

## Rematch flow

When a game has ended, the losing player may request a rematch. The winner may then accept or reject it.

Flow:

1. loser calls `request_rematch`
2. server stores the pending rematch request on the finished room
3. winner calls `accept_rematch` or `reject_rematch`
4. if accepted, the room is reset to the `placement` phase in the same room name and both players are re-prepared for a new round
5. if rejected, the loser cannot issue another rematch request for that finished game

This is handled in the room lifecycle and socket event layer, not by creating a brand-new room.

## Shared contracts

The game contract is defined in the shared types package. It includes the room lifecycle phases, session shape, and all Socket.IO events used by the server and web client.

## Validation

From the server package, run the test suite:

```sh
cd apps/server
pnpm test
```

The server suite covers reconnect restoration, room lifecycle transitions, disconnect handling, and the rematch flow.
