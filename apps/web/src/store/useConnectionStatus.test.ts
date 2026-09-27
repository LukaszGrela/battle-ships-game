import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { socketMock, listeners } = vi.hoisted(() => {
  type SocketListener = (...args: unknown[]) => void;

  const listeners: Record<string, SocketListener> = {};
  const socketMock = {
    connected: true,
    on: vi.fn((event: string, callback: SocketListener) => {
      listeners[event] = callback;
      return socketMock;
    }),
    off: vi.fn((event: string) => {
      delete listeners[event];
      return socketMock;
    }),
  };

  return { socketMock, listeners };
});

vi.mock("../socket", () => ({
  socket: socketMock,
}));

import { useConnectionStatus, useSocketConnection } from "./useConnectionStatus";

describe("useConnectionStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    useConnectionStatus.setState({
      connected: false,
      clientSession: undefined,
    });
  });

  it("reads the current socket connection state on mount", () => {
    renderHook(() => useSocketConnection());

    expect(useConnectionStatus.getState().connected).toBe(true);
    expect(socketMock.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith(
      "session_created",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "session_restored",
      expect.any(Function),
    );
  });

  it("updates the connection flag when socket connection changes", () => {
    renderHook(() => useSocketConnection());

    act(() => {
      listeners.connect?.();
    });
    expect(useConnectionStatus.getState().connected).toBe(true);

    act(() => {
      listeners.disconnect?.();
    });
    expect(useConnectionStatus.getState().connected).toBe(false);
  });

  it("stores session data when a session is created or restored", () => {
    renderHook(() => useSocketConnection());

    const createdSession = {
      id: "player-1",
      socketId: "socket-1",
      gameId: "game-1",
      name: "Captain Black",
      seed: 42,
    };

    const restoredSession = {
      id: "player-1",
      socketId: "socket-2",
      gameId: undefined,
      name: "Captain Red",
      seed: 11,
    };

    act(() => {
      listeners.session_created?.(createdSession);
    });
    expect(useConnectionStatus.getState().clientSession).toEqual(createdSession);

    act(() => {
      listeners.session_restored?.(restoredSession);
    });
    expect(useConnectionStatus.getState().clientSession).toEqual(restoredSession);
  });
});
