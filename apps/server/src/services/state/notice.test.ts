import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RESTART_RECONNECT_NOTICE_MS,
  SHUTDOWN_NOTICE_FLUSH_MS,
  SHUTDOWN_RECONNECT_NOTICE_MS,
} from "../../config/state.js";
import { announceServerRestart, buildRestartNotice } from "./notice.js";

describe("server restart notice", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("treats a supervisor restart as a planned return", () => {
    expect(buildRestartNotice("SIGTERM")).toEqual({
      reason: "restart",
      graceMs: RESTART_RECONNECT_NOTICE_MS,
    });
  });

  it("does not promise a return for a manual Ctrl-C stop", () => {
    expect(buildRestartNotice("SIGINT")).toEqual({
      reason: "shutdown",
      graceMs: SHUTDOWN_RECONNECT_NOTICE_MS,
    });
  });

  it("emits the notice and only then lets the shutdown continue", async () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const notice = buildRestartNotice("SIGTERM");

    let done = false;
    const pending = announceServerRestart({ emit }, notice).then(() => {
      done = true;
    });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("server_restarting", notice);
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(SHUTDOWN_NOTICE_FLUSH_MS);
    await pending;

    expect(done).toBe(true);
  });

  it("stays short enough not to drag a restart out", () => {
    expect(SHUTDOWN_NOTICE_FLUSH_MS).toBeGreaterThan(0);
    expect(SHUTDOWN_NOTICE_FLUSH_MS).toBeLessThanOrEqual(500);
    expect(SHUTDOWN_RECONNECT_NOTICE_MS).toBeLessThan(
      RESTART_RECONNECT_NOTICE_MS,
    );
  });
});
