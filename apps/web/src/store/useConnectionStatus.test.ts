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

import {
  useConnectionStatus,
  useSocketConnection,
} from "./useConnectionStatus";

describe("useConnectionStatus", () => {
  afterEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    useConnectionStatus.setState({
      connected: false,
      clientSession: undefined,
      phase: "idle",
      restartNotice: undefined,
      restartAt: undefined,
      restoredAt: undefined,
    });
  });

  it("reads the current socket connection state on mount", () => {
    renderHook(() => useSocketConnection());

    expect(useConnectionStatus.getState().connected).toBe(true);
    expect(socketMock.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "session_created",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "session_restored",
      expect.any(Function),
    );
    expect(socketMock.on).toHaveBeenCalledWith(
      "server_restarting",
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
    expect(useConnectionStatus.getState().phase).toBe("reconnecting");
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
    expect(useConnectionStatus.getState().clientSession).toEqual(
      createdSession,
    );

    act(() => {
      listeners.session_restored?.(restoredSession);
    });
    expect(useConnectionStatus.getState().clientSession).toEqual(
      restoredSession,
    );
  });

  describe("planned server restart", () => {
    const notice = { reason: "restart" as const, graceMs: 10_000 };

    it("opens the port screen when the server announces a restart", () => {
      renderHook(() => useSocketConnection());

      act(() => {
        listeners.server_restarting?.(notice);
      });

      const state = useConnectionStatus.getState();
      expect(state.phase).toBe("server-restarting");
      expect(state.restartNotice).toEqual(notice);
      expect(typeof state.restartAt).toBe("number");
      // the socket is still open for a moment, but the board is already closed
      expect(state.connected).toBe(true);
      expect(state.restoredAt).toBeUndefined();
    });

    it("keeps the port screen when the socket closes behind the notice", () => {
      renderHook(() => useSocketConnection());

      act(() => {
        listeners.server_restarting?.(notice);
      });
      act(() => {
        listeners.disconnect?.("transport close");
      });

      const state = useConnectionStatus.getState();
      expect(state.connected).toBe(false);
      expect(state.phase).toBe("server-restarting");
      expect(state.restartNotice).toEqual(notice);
    });

    it("flags a restored session so the return can be announced", () => {
      renderHook(() => useSocketConnection());

      const session = {
        id: "player-1",
        socketId: "socket-3",
        gameId: "game-1",
        name: "Captain Black",
        seed: 42,
      };

      act(() => {
        listeners.server_restarting?.(notice);
        listeners.disconnect?.("transport close");
        listeners.connect?.();
        listeners.session_restored?.(session);
      });

      const state = useConnectionStatus.getState();
      expect(state.connected).toBe(true);
      expect(state.phase).toBe("connected");
      expect(typeof state.restoredAt).toBe("number");
      expect(state.restartNotice).toBeUndefined();
      expect(state.clientSession).toEqual(session);

      act(() => {
        useConnectionStatus.getState().dismissRestored();
      });
      expect(useConnectionStatus.getState().restoredAt).toBeUndefined();
    });

    it("does not announce a return when the server kicked the socket", () => {
      renderHook(() => useSocketConnection());

      act(() => {
        listeners.disconnect?.("io server disconnect");
      });

      const state = useConnectionStatus.getState();
      expect(state.phase).toBe("reconnecting");
      expect(state.restartNotice).toBeUndefined();
    });

    it("does not announce a return for a plain reconnect", () => {
      renderHook(() => useSocketConnection());

      act(() => {
        listeners.disconnect?.("transport close");
        listeners.connect?.();
        listeners.session_restored?.({
          id: "player-1",
          socketId: "socket-4",
          gameId: undefined,
          name: "Captain Red",
          seed: 7,
        });
      });

      const state = useConnectionStatus.getState();
      expect(state.phase).toBe("connected");
      expect(state.restoredAt).toBeUndefined();
    });
  });
});
