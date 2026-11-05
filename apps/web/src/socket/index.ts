import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { getSessionToken, setSessionToken } from "./sessionTokenStorage";

const URL =
  import.meta.env.MODE === "production"
    ? undefined
    : `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket: Socket<IServerToClientEvents, IClientToServerEvents> = io(
  URL,
  {
    // Function form: evaluated on EVERY connection attempt, so a reconnect
    // always sends the most recent (renewed) token, not the one from page load.
    auth: (cb) => cb({ token: getSessionToken() }),
    autoConnect: false,
    transports: ["websocket"],

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2_000,
  },
);

// Sent by the server on every successful connect (first visit: brand-new
// identity; later: the same identity with a renewed expiry).
socket.on("session_token", setSessionToken);

if (import.meta.env.MODE === "development") {
  socket.onAny((event, ...args) => {
    console.groupCollapsed(`[WEB SOCKET]`);
    console.log(`Event: ${event}`, args);
    console.log("", "did you remember to handle this event?");
    console.groupEnd();
  });
}

export const useSocket = () => {
  const connect = useCallback(() => {
    socket.connect();
  }, []);
  const disconnect = useCallback(() => {
    socket.disconnect();
  }, []);

  const disconnectFromServer = useCallback(() => {
    socket.emit("disconnect_from_server");
  }, []);

  return { connect, disconnect, disconnectFromServer };
};

document.addEventListener("visibilitychange", () => {
  console.log("VisibilityChange", document.visibilityState, socket.disconnect);
  if (document.visibilityState === "visible" && socket.disconnected) {
    socket.connect(); // nie czekaj na timer reconnectu, łącz od razu
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).socket = socket;
