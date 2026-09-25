import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { setWaiting } from "../../../utils/setWaiting";

export const dataTampered = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const session = ClientSessionServiceSingleton.getInstance();
  const clientId = socket.handshake.auth.clientId;
  const clientSession = session.readSession(clientId);

  console.group("[dataTampered]");
  console.error("clientId", clientId);
  console.error("clientSession", clientSession);
  console.groupEnd();

  socket.emit("error", "Internal server error");
  socket.emit("game_updated", null);
  session.deleteSession(clientId);
  setWaiting(io, socket);
};
