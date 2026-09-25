import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { getClientId } from "./getClientId";

const URL =
  import.meta.env.MODE === "production"
    ? undefined
    : `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<IServerToClientEvents, IClientToServerEvents> = io(
  URL,
  {
    auth: {
      clientId: getClientId(),
    },
    autoConnect: false,
    transports: ["websocket"],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2_000,
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

document.addEventListener("visibilitychange", () => {
  console.log("VisibilityChange", document.visibilityState, socket.disconnect);
  if (document.visibilityState === "visible" && socket.disconnected) {
    socket.connect(); // nie czekaj na timer reconnectu, łącz od razu
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).socket = socket;
