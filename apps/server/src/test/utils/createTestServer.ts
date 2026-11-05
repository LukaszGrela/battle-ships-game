import type { AddressInfo } from "node:net";
import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";
import type { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { createGameServer, type IGameServerOptions } from "../../server";

/**
 * Fixed, obviously-fake secret. Fixed (not randomUUID) so a token signed in one
 * test can be verified or replayed in another. 40+ chars, so it still passes if
 * `createGameServer` ever starts enforcing a minimum length.
 */
export const TEST_SESSION_SECRET =
  "test-only-secret-not-used-anywhere-else-0123456789";

/**
 * Every test client comes from 127.0.0.1, so the production guards (10 handshake
 * burst, 5 sockets per IP, 40 events/s) would reject unrelated tests. Keep the
 * guards ON but wide: a test that floods by accident still fails loudly instead
 * of silently running without protection.
 */
export const TEST_LIMITS: Pick<
  IGameServerOptions,
  "rateLimit" | "ipLimit" | "maxConnectionsPerIp"
> = {
  maxConnectionsPerIp: 100,
  rateLimit: {
    burst: 1_000,
    perSecond: 1_000,
    eventBurst: 1_000,
    eventPerSecond: 1_000,
    maxViolationsBeforeDisconnect: 1_000,
  },
  ipLimit: {
    capacity: 1_000,
    refillPerSecond: 1_000,
    denialsBeforeBan: 1_000,
  },
};

export interface ITestClientOptions {
  /** Session token from a previous connection. Omit for a fresh identity. */
  token?: string;
  /** Extra handshake fields, e.g. `{ origin }` to exercise the origin check. */
  extraHeaders?: Record<string, string>;
}

export interface ITestClientHandle {
  client: ClientSocket<IServerToClientEvents, IClientToServerEvents>;
  /** Resolves with the `session_token` the server sends on every connect. */
  token: Promise<string>;
}

export async function createTestServer(overrides: IGameServerOptions = {}) {
  // Explicit secret: `createGameServer()` throws without SESSION_SECRET, and
  // relying on process.env here makes the test depend on local state.
  const server = createGameServer({
    sessionSecret: TEST_SESSION_SECRET,
    instrumentAdminUi: false, // no admin namespace / no accidental prod throw
    ...TEST_LIMITS,
    ...overrides,
  });

  await new Promise<void>((resolve) => {
    // Port 0 = let the OS pick, so parallel test files never collide.
    server.httpServer.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const clients = new Set<ClientSocket>();

  return {
    server,
    io: server.io,
    url,
    port,

    /**
     * Creates a client and starts connecting. The token promise is wired up
     * *before* `connect()`, otherwise the first `session_token` (emitted
     * immediately on connection) would be missed.
     */
    connectClient(options: ITestClientOptions = {}): ITestClientHandle {
      const client: ClientSocket<IServerToClientEvents, IClientToServerEvents> =
        createClient(url, {
          // Function form, same as the app: re-read the token per attempt.
          auth: (cb) => cb(options.token ? { token: options.token } : {}),
          transports: ["websocket"],
          // `io()` auto-connects on creation, which would start the handshake
          // before the `session_token` listener below is attached - the token
          // would be missed. Connect explicitly instead.
          autoConnect: false,
          reconnection: false, // tests assert exact connect counts
          forceNew: true, // never reuse a cached manager between tests
          timeout: 2_000,
          extraHeaders: options.extraHeaders,
        });

      clients.add(client);
      const token = new Promise<string>((resolve, reject) => {
        client.once("session_token", resolve);
        // Reject instead of hanging when the handshake is refused: otherwise a
        // guard test that awaits `token` waits out Vitest's whole test timeout.
        client.once("connect_error", reject);
      });
      // Mark the rejection as handled. A guard test deliberately rejects the
      // handshake and never awaits `token`; without this the rejection escapes
      // as an "Unhandled Rejection" and fails the file, with Vitest attributing
      // it to whichever test happened to be running when it surfaced. Callers
      // that do `await token` still get the error.
      token.catch(() => {});
      client.connect();
      return { client, token };
    },

    /** Disconnects test clients, then closes io (and its HTTP server). */
    async close() {
      for (const client of clients) client.disconnect();
      clients.clear();
      await server.close();
    },
  };
}

export type TTestServer = Awaited<ReturnType<typeof createTestServer>>;

/** Resolves on a successful handshake. */
export function waitForConnect(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", (error) => reject(error));
  });
}

/**
 * Resolves with the rejection reason instead of throwing - the shape a guard
 * test wants, since `allowRequest` failures surface as `connect_error`.
 */
export function waitForConnectError(client: ClientSocket): Promise<Error> {
  return new Promise((resolve, reject) => {
    client.once("connect_error", (error) => resolve(error));
    client.once("connect", () =>
      reject(new Error("expected the handshake to be rejected, but it connected")),
    );
  });
}
