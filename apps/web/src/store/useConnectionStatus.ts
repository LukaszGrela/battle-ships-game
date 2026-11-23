import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";
import { IClientSession, IServerRestartNotice } from "@repo/types";

/**
 * `idle` — the tab has not connected yet (the splash screen owns that).
 * `connected` — the socket is up, the board accepts clicks.
 * `reconnecting` — the socket dropped for a reason we cannot explain
 *   (wifi, sleep, proxy) and Socket.IO is retrying on its own.
 * `server-restarting` — the server told us it is going down on purpose, so we
 *   show the port screen with a countdown instead of a naked disconnect.
 */
export type TConnectionPhase =
  "idle" | "connected" | "reconnecting" | "server-restarting";

/** How long the "welcome back" toast stays on screen. */
export const RESTORED_TOAST_MS = 6_000;

interface IConnectionStatus {
  connected: boolean;

  clientSession?: IClientSession;

  phase: TConnectionPhase;

  /** Last planned-shutdown notice, kept so the return can be announced. */
  restartNotice?: IServerRestartNotice;

  /** When that notice arrived; the port screen counts down from here. */
  restartAt?: number;

  /** Set when a session came back after a planned restart. */
  restoredAt?: number;

  setIsConnected: (connected: boolean) => void;
  setClientSession: (session?: IClientSession) => void;
  announceServerRestart: (notice: IServerRestartNotice) => void;
  notifyDisconnect: (reason: string) => void;
  notifySessionRestored: () => void;
  dismissRestored: () => void;
}

export const useConnectionStatus = create<IConnectionStatus>((set) => ({
  connected: false,
  phase: "idle",
  setClientSession: (session?: IClientSession) =>
    set({ clientSession: session }),

  setIsConnected: (connected) =>
    set((state) => {
      if (connected) {
        // Coming back: the port screen has done its job, whatever happens next
        // (session restored, or a fresh lobby).
        return { connected: true, phase: "connected" };
      }
      // A planned restart already owns the screen; a plain drop does not.
      return {
        connected: false,
        phase:
          state.phase === "server-restarting"
            ? "server-restarting"
            : "reconnecting",
      };
    }),

  announceServerRestart: (notice) =>
    set({
      phase: "server-restarting",
      restartNotice: notice,
      restartAt: Date.now(),
    }),

  /**
   * Socket.IO also calls this "disconnect" when the *server* kicked us
   * (`io server disconnect`, e.g. an intentional kick). That is not a network
   * problem, so it must not promise a return that will not happen.
   */
  notifyDisconnect: (reason) =>
    set((state) => {
      if (state.phase === "server-restarting") {
        return { connected: false };
      }
      const kicked = reason === "io server disconnect";
      return {
        connected: false,
        phase: "reconnecting",
        restartNotice: kicked ? undefined : state.restartNotice,
        restartAt: kicked ? undefined : state.restartAt,
      };
    }),

  notifySessionRestored: () =>
    set((state) => {
      if (!state.restartNotice && state.phase !== "server-restarting") {
        return { connected: true, phase: "connected" };
      }
      // Returning from a planned restart — worth one short toast.
      return {
        connected: true,
        phase: "connected",
        restoredAt: Date.now(),
        restartNotice: undefined,
        restartAt: undefined,
      };
    }),

  dismissRestored: () =>
    set({ restoredAt: undefined, restartNotice: undefined }),
}));

export const useSocketConnection = () => {
  const { setIsConnected, setClientSession } = useConnectionStatus();
  useEffect(() => {
    if (socket.connected) {
      setIsConnected(true);
    }

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect(reason: string) {
      useConnectionStatus.getState().notifyDisconnect(reason);
    }
    function onServerRestarting(notice: IServerRestartNotice) {
      useConnectionStatus.getState().announceServerRestart(notice);
    }
    function onSessionRestored(session: IClientSession) {
      setClientSession(session);
      useConnectionStatus.getState().notifySessionRestored();
    }
    function onSessionCreated(session: IClientSession) {
      setClientSession(session);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("server_restarting", onServerRestarting);

    socket.on("session_created", onSessionCreated);
    socket.on("session_restored", onSessionRestored);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("server_restarting", onServerRestarting);
      socket.off("session_restored", onSessionRestored);
      socket.off("session_created", onSessionCreated);
    };
  }, [setClientSession, setIsConnected]);
};
