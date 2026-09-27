import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";
import { IClientSession } from "@repo/types";

interface IConnectionStatus {
  connected: boolean;

  clientSession?: IClientSession;

  setIsConnected: (connected: boolean) => void;
  setClientSession: (session?: IClientSession) => void;
}

export const useConnectionStatus = create<IConnectionStatus>((set) => ({
  connected: false,
  setClientSession: (session?: IClientSession) =>
    set({ clientSession: session }),
  setIsConnected: (connected) => set({ connected }),
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
    function onDisconnect() {
      setIsConnected(false);
    }
    function onSessionRestored(session: IClientSession) {
      console.log("Restored session", session);
      setClientSession(session);
    }
    function onSessionCreated(session: IClientSession) {
      console.log("Created new session");
      setClientSession(session);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("session_created", onSessionCreated);
    socket.on("session_restored", onSessionRestored);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("session_restored", onSessionRestored);
      socket.off("session_created", onSessionCreated);
    };
  }, [setClientSession, setIsConnected]);
};
