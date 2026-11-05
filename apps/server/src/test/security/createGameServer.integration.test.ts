import { afterEach, describe, expect, it } from "vitest";
import { signSession, verifySession } from "../../security/auth";
import {
  createTestServer,
  TEST_SESSION_SECRET,
  waitForConnect,
  waitForConnectError,
  type TTestServer,
} from "../utils/createTestServer";

let ctx: TTestServer;

afterEach(async () => {
  await ctx?.close();
});

describe("createGameServer (integration)", () => {
  it("boots without SESSION_SECRET in the environment", async () => {
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      ctx = await createTestServer();
      const { client, token } = ctx.connectClient();
      await waitForConnect(client);

      // Identity is minted server-side even when the client sends nothing.
      const issued = await token;
      expect(verifySession(issued, TEST_SESSION_SECRET)?.playerId).toBeTruthy();
    } finally {
      if (saved !== undefined) process.env.SESSION_SECRET = saved;
    }
  });

  it("keeps the same playerId when the issued token is replayed", async () => {
    ctx = await createTestServer();

    const first = ctx.connectClient();
    await waitForConnect(first.client);
    const firstToken = await first.token;
    const firstPlayerId = verifySession(
      firstToken,
      TEST_SESSION_SECRET,
    )?.playerId;
    first.client.disconnect();

    const second = ctx.connectClient({ token: firstToken });
    await waitForConnect(second.client);
    const secondToken = await second.token;

    expect(verifySession(secondToken, TEST_SESSION_SECRET)?.playerId).toBe(
      firstPlayerId,
    );
  });

  it("mints a new identity for a token signed with a different secret", async () => {
    ctx = await createTestServer();

    const forged = signSession(
      { playerId: "someone-else" },
      "wrong-secret",
      60,
    );
    const { client, token } = ctx.connectClient({ token: forged });
    await waitForConnect(client);

    expect(verifySession(await token, TEST_SESSION_SECRET)?.playerId).not.toBe(
      "someone-else",
    );
  });

  it("rejects a browser origin outside the allowlist", async () => {
    const warnings: { message: string; meta?: Record<string, unknown> }[] = [];
    ctx = await createTestServer({
      allowedOrigins: ["https://example.test"],
      logger: { warn: (message, meta) => warnings.push({ message, meta }) },
    });

    const { client } = ctx.connectClient({
      extraHeaders: { Origin: "https://evil.test" },
    });

    const error = await waitForConnectError(client);
    expect(error).toBeInstanceOf(Error);
    expect(client.connected).toBe(false);
    expect(ctx.io.of("/").sockets.size).toBe(0); // no socket was allocated

    // ...connect with Origin: https://evil.test...
    expect(warnings).toContainEqual({
      message: "socket.handshake.rejected.origin",
      meta: { origin: "https://evil.test" },
    });
  });

  it("survives a connect/disconnect loop that would trip the default IP limit", async () => {
    // 15 handshakes > the production burst of 10, so this fails unless the
    // widened `ipLimit` from the helper is actually passed through.
    ctx = await createTestServer();

    for (let i = 0; i < 15; i += 1) {
      const { client } = ctx.connectClient();
      await waitForConnect(client);
      client.disconnect();
    }
  });
  it("accepts a browser origin on the allowlist", async () => {
    ctx = await createTestServer({ allowedOrigins: ["https://example.test"] });
    const { client } = ctx.connectClient({
      extraHeaders: { Origin: "https://example.test" },
    });
    await waitForConnect(client);
    expect(client.connected).toBe(true);
  });
});
