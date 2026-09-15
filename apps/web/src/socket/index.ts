import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { useCallback } from "react";
import { io, type Socket } from "socket.io-client";

console.log("import.meta.env.MODE");
const URL =
  import.meta.env.MODE === "production"
    ? undefined
    : `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<IServerToClientEvents, IClientToServerEvents> = io(
  URL,
  {
    autoConnect: false,
    transports: ["websocket"],
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
