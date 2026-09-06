import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";

interface IConnectionStatus {
  connected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const useConnectionStatus = create<IConnectionStatus>((set) => ({
  connected: false,
  setIsConnected: (connected) => set({ connected }),
}));

export const useSocketConnection = () => {
  const { setIsConnected } = useConnectionStatus();
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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [setIsConnected]);
};
