import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  STATE_RESTART_PATH,
  STATE_SAVE_PATH,
  STATE_TOKEN_HEADER,
  createStateHttpHandler,
} from "./http";

interface ICallOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}

const createResponse = () => {
  const res = {
    statusCode: 0,
    body: "",
    headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      this.statusCode = status;
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    end(chunk?: string) {
      this.body = chunk ?? "";
      return this;
    },
  };

  return res;
};

const call = async (
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  { method = "POST", url = STATE_SAVE_PATH, headers = {} }: ICallOptions = {},
) => {
  const req = { method, url, headers, resume: vi.fn() };
  const res = createResponse();

  await handler(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
  );

  return res;
};

describe("services/state/http", () => {
  const createHandler = (overrides: Record<string, unknown> = {}) => {
    const save = vi.fn(async () => ({
      savedAt: "2026-01-01T00:00:00.000Z",
      bytes: 42,
      rooms: 1,
      sessions: 2,
      gameStats: 3,
      bots: 0,
    }));

    const handler = createStateHttpHandler({
      enabled: true,
      saveToken: "secret-token",
      getVersion: async () => "0.4.2",
      getSocketCount: () => 1,
      save,
      now: () => 1_700_000_000_000,
      ...overrides,
    });

    return { handler, save };
  };

  it("serves the health probe", async () => {
    const { handler } = createHandler();

    const res = await call(handler, { method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      status: "ok",
      version: "0.4.2",
    });
  });

  it("hides the save endpoint without a token", async () => {
    const { handler, save } = createHandler();

    const res = await call(handler);

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
    expect(save).not.toHaveBeenCalled();
  });

  it("hides the save endpoint for an invalid token", async () => {
    const { handler, save } = createHandler();

    const res = await call(handler, {
      headers: { [STATE_TOKEN_HEADER]: "wrong" },
    });

    expect(res.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("hides an unconfigured deployment the same way", async () => {
    const { handler, save } = createHandler({ saveToken: undefined });

    const res = await call(handler, {
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not save on a GET even with a valid token", async () => {
    const { handler, save } = createHandler();

    const res = await call(handler, {
      method: "GET",
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("saves with a valid header token", async () => {
    const { handler, save } = createHandler();

    const res = await call(handler, {
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, rooms: 1 });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("accepts the token as a bearer credential", async () => {
    const { handler, save } = createHandler();

    const res = await call(handler, {
      headers: { authorization: "Bearer secret-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps unknown paths at 404", async () => {
    const { handler } = createHandler();

    const res = await call(handler, { url: "/admin/state/save-anyway" });

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
  });

  it("reports a failed save only to an authenticated caller", async () => {
    const { handler } = createHandler({
      save: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });

    const anonymous = await call(handler);
    expect(anonymous.statusCode).toBe(404);

    const authenticated = await call(handler, {
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });
    expect(authenticated.statusCode).toBe(500);
  });

  it("announces the restart, then saves", async () => {
    const order: string[] = [];
    const announceRestart = vi.fn(async () => {
      order.push("announce");
    });
    const { handler } = createHandler({
      announceRestart,
      save: vi.fn(async () => {
        order.push("save");
        return {
          savedAt: "2026-01-01T00:00:00.000Z",
          bytes: 42,
          rooms: 1,
          sessions: 2,
          gameStats: 3,
          bots: 0,
        };
      }),
    });

    const res = await call(handler, {
      url: STATE_RESTART_PATH,
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      ok: true,
      announced: "restart",
    });
    expect(announceRestart).toHaveBeenCalledWith("restart");
    // The notice is only useful while the sockets are still open.
    expect(order).toEqual(["announce", "save"]);
  });

  it("warns about a stop when asked to", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler } = createHandler({ announceRestart });

    const res = await call(handler, {
      url: `${STATE_RESTART_PATH}?reason=shutdown`,
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ announced: "shutdown" });
    expect(announceRestart).toHaveBeenCalledWith("shutdown");
  });

  it("falls back to a restart for an unknown reason", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler } = createHandler({ announceRestart });

    const res = await call(handler, {
      url: `${STATE_RESTART_PATH}?reason=destroy-everything`,
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(JSON.parse(res.body)).toMatchObject({ announced: "restart" });
  });

  it("hides the restart endpoint without a token", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler, save } = createHandler({ announceRestart });

    const res = await call(handler, { url: STATE_RESTART_PATH });

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("");
    expect(announceRestart).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("hides the restart endpoint when persistence is off", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler } = createHandler({
      announceRestart,
      enabled: false,
    });

    const res = await call(handler, {
      url: STATE_RESTART_PATH,
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(404);
    expect(announceRestart).not.toHaveBeenCalled();
  });

  it("does not announce on a GET", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler } = createHandler({ announceRestart });

    const res = await call(handler, {
      method: "GET",
      url: STATE_RESTART_PATH,
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(404);
    expect(announceRestart).not.toHaveBeenCalled();
  });

  it("keeps the save route silent about restarts", async () => {
    const announceRestart = vi.fn(async () => {});
    const { handler } = createHandler({ announceRestart });

    const res = await call(handler, {
      headers: { [STATE_TOKEN_HEADER]: "secret-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).announced).toBeUndefined();
    expect(announceRestart).not.toHaveBeenCalled();
  });
});
