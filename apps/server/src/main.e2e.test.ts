import { afterEach, describe, expect, it } from "vitest";
import { io as createSocketClient, type Socket } from "socket.io-client";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
  TAttackResult,
  TCellStatusShipId,
  TGameState,
  TShip,
} from "@repo/types";
import ActiveGameRegistrySingleton from "./services/active-game-registry";
import ClientSessionServiceSingleton from "./services/client-session.service";
import { createGameServer } from "./server.js";
import { signSession } from "./security/auth.js";

export const TEST_SESSION_SECRET =
  "test-only-secret-do-not-use-anywhere-else-0123456789";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessions = ClientSessionServiceSingleton.getInstance();

type TestClient = Socket<IServerToClientEvents, IClientToServerEvents>;

const eventTimeoutMs = 10_000;

function waitForCondition(
  condition: () => boolean,
  description: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timed out waiting for ${description}`));
    }, eventTimeoutMs);
    const interval = setInterval(() => {
      if (!condition()) return;
      clearTimeout(timeout);
      clearInterval(interval);
      resolve();
    }, 5);
  });
}

/**
 * Application events only. `connect`, `connect_error` and `disconnect` are
 * reserved: they live in `SocketReservedEventsMap`, not in
 * `IServerToClientEvents`, so a key constrained to this union can never name
 * them. Those three are awaited through `waitForConnect` below, where the
 * literal resolves socket.io-client's built-in overload.
 */
type TAppEvent = keyof IServerToClientEvents;

/**
 * `socket.on` is generic over
 * `ReservedOrUserEventNames<SocketReservedEvents, IServerToClientEvents>` and its
 * listener parameter is the matching union of every listener signature. A helper
 * that indexes an event name from a variable cannot satisfy that without a cast,
 * so the cast lives here once instead of at each call site. The event name stays
 * checked against `TAppEvent`; the payload type is asserted by the caller via `T`.
 */
type TListener = (payload: unknown) => void;
const rawEmitter = (socket: TestClient) =>
  socket as unknown as {
    on: (event: string, listener: TListener) => void;
    off: (event: string, listener: TListener) => void;
  };

function waitForEvent<T>(
  socket: TestClient,
  event: TAppEvent,
  predicate: (payload: T) => boolean = () => true,
): Promise<T> {
  const emitter = rawEmitter(socket);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      emitter.off(event, listener);
      reject(new Error(`Timed out waiting for '${event}'`));
    }, eventTimeoutMs);

    const listener: TListener = (payload) => {
      const typed = payload as T;
      if (!predicate(typed)) return;
      clearTimeout(timeout);
      emitter.off(event, listener);
      resolve(typed);
    };

    emitter.on(event, listener);
  });
}

const waitForGameState = (
  socket: TestClient,
  predicate: (state: TGameState) => boolean,
) => waitForEvent(socket, "game_updated", predicate);

/**
 * `connect` is a reserved engine.io event, not a member of
 * `IServerToClientEvents`, so it is awaited here with its own literal overload.
 */
function waitForConnect(socket: TestClient): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
}

/**
 * A packet dropped by the rate limiter never gets an ack, so a bare
 * `emitWithAck` hangs until the 60s test timeout. This keeps a throttled shot
 * a 5s failure with a message instead.
 */
const ACK_TIMEOUT_MS = 5_000;

const attack = (socket: TestClient, target: { x: number; y: number }) =>
  socket.timeout(ACK_TIMEOUT_MS).emitWithAck("attack_coordinate", target);

const createFleet = (): (TShip & {
  type: "pending";
  id: TCellStatusShipId;
})[] =>
  [5, 4, 3, 3, 2].map((size, index) => ({
    id: (index + 1) as TCellStatusShipId,
    size,
    type: "pending",
    placed: true,
    coords: { x: 0, y: index * 2 },
    orientation: "horizontal",
  }));

const fleetCells = [
  ...Array.from({ length: 5 }, (_, x) => ({ x, y: 0 })),
  ...Array.from({ length: 4 }, (_, x) => ({ x, y: 2 })),
  ...Array.from({ length: 3 }, (_, x) => ({ x, y: 4 })),
  ...Array.from({ length: 3 }, (_, x) => ({ x, y: 6 })),
  ...Array.from({ length: 2 }, (_, x) => ({ x, y: 8 })),
];

const missCells = Array.from({ length: 16 }, (_, index) =>
  index < 10 ? { x: 9, y: index } : { x: 8, y: index - 10 },
);

async function connectToLobby(
  clientId: string,
  url: string,
): Promise<TestClient> {
  const token = signSession({ playerId: clientId }, TEST_SESSION_SECRET, 3600);
  const socket = createSocketClient(url, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    // `io()` auto-connects on creation, which would start the handshake before
    // the listeners below are attached - `session_created` / `open_games` would
    // be missed and the test would sit until the timeout. Connect explicitly.
    autoConnect: false,
  }) as unknown as TestClient;
  const connected = waitForConnect(socket);
  const sessionCreated = waitForEvent(socket, "session_created");
  const lobbyUpdate = waitForEvent(socket, "open_games");
  const initialGameState = waitForEvent(
    socket,
    "game_updated",
    (state) => state === null,
  );

  socket.connect();
  await Promise.all([connected, sessionCreated, lobbyUpdate, initialGameState]);
  return socket;
}

async function finishGameWithFleetAttacks(
  owner: TestClient,
  opponent: TestClient,
  finishedState: Promise<TGameState>,
): Promise<TGameState> {
  for (const [index, target] of fleetCells.entries()) {
    const result = await attack(owner, target);
    expect(result.ok).toBe(true);
    if (index < fleetCells.length - 1) {
      const missResult = await attack(opponent, missCells[index]!);
      expect(missResult).toEqual({ ok: true, status: 0 });
    }
  }

  return finishedState;
}

describe("main Socket.IO E2E", () => {
  let closeServer: (() => Promise<void>) | undefined;
  let clients: TestClient[] = [];

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    clients = [];
    await closeServer?.();
    closeServer = undefined;

    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    sessions
      .listSessions()
      .forEach((session) => sessions.deleteSession(session.id));
  });

  it("plays a full game, accepts and finishes a rematch, then lets both players leave", async () => {
    const server = createGameServer({
      sessionSecret: TEST_SESSION_SECRET,
      instrumentAdminUi: false,
      reconnectSweepIntervalMs: 60_000,
      // Limits stay on - just wide enough that a full E2E run (~40 events per
      // player, 17 attacks in one loop) is not mistaken for a flood.
      rateLimit: {
        burst: 10_000,
        perSecond: 1_000,
        eventBurst: 10_000,
        eventPerSecond: 1_000,
        maxViolationsBeforeDisconnect: 10_000,
      },
      ipLimit: {
        capacity: 1_000,
        refillPerSecond: 100,
        denialsBeforeBan: 1_000,
      },
      maxConnectionsPerIp: 100,
    });
    closeServer = server.close;
    await new Promise<void>((resolve) => {
      server.httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the test server to listen on a TCP port");
    }
    const url = `http://127.0.0.1:${address.port}`;

    const owner = await connectToLobby("e2e-owner", url);
    clients.push(owner);
    const roomName = "E2E Battle Room";

    const ownerWelcome = waitForEvent(owner, "welcome");
    const ownerWaitingState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Waiting,
    );
    owner.emit("join_game", roomName);
    await ownerWelcome;
    const waitingState = await ownerWaitingState;
    expect(waitingState.name).toBe(roomName);
    expect(waitingState.self.id).toBe("e2e-owner");

    const opponent = await connectToLobby("e2e-opponent", url);
    clients.push(opponent);

    const opponentConnected = waitForEvent(owner, "opponent_connected");
    const ownerPlacementState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Placement,
    );
    const opponentWelcome = waitForEvent(opponent, "welcome");
    const opponentPlacementState = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Placement,
    );
    opponent.emit("join_game", { id: waitingState.id, name: roomName });
    await Promise.all([
      opponentConnected,
      opponentWelcome,
      ownerPlacementState,
      opponentPlacementState,
    ]);

    const ownerReady = waitForEvent(opponent, "player_ready");
    const ownerReadyState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Placement && state.self.ready,
    );
    owner.emit("place_ships", createFleet());
    await Promise.all([ownerReady, ownerReadyState]);

    const firstGameOwnerState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Playing,
    );
    const firstGameOpponentState = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Playing,
    );
    opponent.emit("place_ships", createFleet());
    await Promise.all([firstGameOwnerState, firstGameOpponentState]);

    const opponentTurnState = waitForGameState(
      opponent,
      (state) =>
        state.phase === EGamePhase.Playing &&
        state.turn === "e2e-opponent" &&
        state.lastAttack?.coords.x === 9 &&
        state.lastAttack?.coords.y === 9,
    );
    const firstMiss = await attack(owner, { x: 9, y: 9 });
    expect(firstMiss).toEqual({ ok: true, status: 0 });
    await opponentTurnState;

    const ownerTurnState = waitForGameState(
      owner,
      (state) =>
        state.phase === EGamePhase.Playing && state.turn === "e2e-owner",
    );
    const opponentMiss = await attack(opponent, { x: 9, y: 8 });
    expect(opponentMiss).toEqual({ ok: true, status: 0 });
    await ownerTurnState;

    const firstFinishedOwnerState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Finished,
    );
    const firstFinishedOpponentState = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Finished,
    );
    const firstFinished = await finishGameWithFleetAttacks(
      owner,
      opponent,
      firstFinishedOwnerState,
    );
    const firstFinishedForOpponent = await firstFinishedOpponentState;
    expect(firstFinished.result).toEqual({
      "e2e-owner": "win",
      "e2e-opponent": "lost",
    });
    expect(firstFinishedForOpponent.phase).toBe(EGamePhase.Finished);

    const rematchRequested = waitForEvent(owner, "rematch_requested");
    const requestState = waitForGameState(
      opponent,
      (state) =>
        state.phase === EGamePhase.Finished &&
        state.rematchRequest?.status === "pending",
    );
    opponent.emit("request_rematch");
    await Promise.all([rematchRequested, requestState]);

    const ownerAccepted = waitForEvent(owner, "rematch_accepted");
    const opponentAccepted = waitForEvent(opponent, "rematch_accepted");
    const ownerRematchPlacement = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Placement,
    );
    const opponentRematchPlacement = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Placement,
    );
    owner.emit("accept_rematch");
    await Promise.all([
      ownerAccepted,
      opponentAccepted,
      ownerRematchPlacement,
      opponentRematchPlacement,
    ]);

    const rematchOwnerPlaying = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Playing,
    );
    const rematchOpponentPlaying = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Playing,
    );
    owner.emit("place_ships", createFleet());
    opponent.emit("place_ships", createFleet());
    await Promise.all([rematchOwnerPlaying, rematchOpponentPlaying]);

    const rematchFinishedOwnerState = waitForGameState(
      owner,
      (state) => state.phase === EGamePhase.Finished,
    );
    const rematchFinishedOpponentState = waitForGameState(
      opponent,
      (state) => state.phase === EGamePhase.Finished,
    );
    const rematchFinished = await finishGameWithFleetAttacks(
      owner,
      opponent,
      rematchFinishedOwnerState,
    );
    const rematchFinishedForOpponent = await rematchFinishedOpponentState;
    expect(rematchFinished.result).toEqual({
      "e2e-owner": "win",
      "e2e-opponent": "lost",
    });
    expect(
      (
        rematchFinished as TGameState & {
          phase: EGamePhase.Finished;
          battleResults: Record<string, number>;
        }
      ).battleResults,
    ).toEqual({
      "e2e-owner": 1,
      "e2e-opponent": 0,
    });
    expect(rematchFinishedForOpponent.phase).toBe(EGamePhase.Finished);

    const activeRoom = activeGames.getRoom(rematchFinished.id)!;
    expect(activeRoom.getPlayer("e2e-owner")?.active).toBe(true);
    expect(activeRoom.getPlayer("e2e-opponent")?.active).toBe(true);
    expect(sessions.readSession("e2e-owner")?.socketId).toBe(owner.id);
    expect(sessions.readSession("e2e-opponent")?.socketId).toBe(opponent.id);

    const opponentLeft = waitForCondition(
      () => sessions.readSession("e2e-opponent")?.gameId === undefined,
      "opponent leave to clear their game session",
    );
    opponent.emit("leave_game");
    await opponentLeft;
    const ownerLeft = waitForCondition(
      () => sessions.readSession("e2e-owner")?.gameId === undefined,
      "owner leave to clear their game session",
    );
    owner.emit("leave_game");
    await ownerLeft;

    expect(sessions.readSession("e2e-owner")?.gameId).toBeUndefined();
    expect(sessions.readSession("e2e-opponent")?.gameId).toBeUndefined();
  }, 60_000);
});
