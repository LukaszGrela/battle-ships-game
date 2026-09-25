import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";

type TRejoinGameHandler = IClientToServerEvents["rejoin_game"];

export const factoryRejoinGameHandler = (
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TRejoinGameHandler => {
  return () => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const clientSession = session.readSession(clientId);
    console.log("rejoin_game not implemented", clientSession);
    socket.emit("error", "Method rejoin_game not implemented!");
  };
};
