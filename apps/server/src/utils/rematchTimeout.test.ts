import { afterEach, describe, expect, it, vi } from "vitest";
import { closeGameRoom } from "./roomLifecycle";
import {
  disposeRematchTimeouts,
  pendingRematchTimeoutCount,
  scheduleRematchTimeout,
} from "./rematchTimeout";

type TIo = Parameters<typeof closeGameRoom>[0];

const createIo = (): TIo =>
  ({
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
  }) as unknown as TIo;

describe("rematch timeout lifecycle", () => {
  afterEach(() => {
    disposeRematchTimeouts();
    vi.useRealTimers();
  });

  it("cancels a pending rematch timer when the room is torn down", () => {
    vi.useFakeTimers();
    const io = createIo();

    scheduleRematchTimeout(io, "room-teardown", "opponent", 60_000);
    expect(pendingRematchTimeoutCount()).toBe(1);

    closeGameRoom(io, "room-teardown", "test-teardown");

    expect(pendingRematchTimeoutCount()).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(io.emit).not.toHaveBeenCalledWith(
      "rematch_cancelled",
      expect.anything(),
    );
  });

  it("drops every pending rematch timer during server shutdown", () => {
    vi.useFakeTimers();
    const io = createIo();

    scheduleRematchTimeout(io, "room-a", "opponent-a", 60_000);
    scheduleRematchTimeout(io, "room-b", "opponent-b", 60_000);
    expect(pendingRematchTimeoutCount()).toBe(2);

    disposeRematchTimeouts();

    expect(pendingRematchTimeoutCount()).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(io.emit).not.toHaveBeenCalledWith(
      "rematch_cancelled",
      expect.anything(),
    );
  });
});
