import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { useCallback } from "react";
import { io, type Socket } from "socket.io-client";

console.log("import.meta.env.MODE");
const URL =
  import.meta.env.MODE === "production" ? undefined : "ws://localhost:3001";

export const socket: Socket<IServerToClientEvents, IClientToServerEvents> = io(
  URL,
  {
    autoConnect: false,
  },
);

export const useSocket = () => {
  const connect = useCallback(() => {
    socket.connect();
  }, []);
  const disconnect = useCallback(() => {
    socket.disconnect();
  }, []);

  return { connect, disconnect };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).socket = socket;
