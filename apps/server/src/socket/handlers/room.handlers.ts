import { Server, Socket } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import ClientSessionServiceSingleton from "../../services/client-session.service";
import { factoryJoinGameHandler } from "./socket.handlers.impl/join_game";
import { factoryLeaveGameHandler } from "./socket.handlers.impl/leave_game";
import { factoryRejoinGameHandler } from "./socket.handlers.impl/rejoin_game";

export const registerRoomHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const session = ClientSessionServiceSingleton.getInstance();
  const clientId = socket.handshake.auth.clientId;

  if (
    !clientId ||
    typeof clientId !== "string" ||
    session.readSession(clientId) === null
  ) {
    socket.disconnect();
    return;
  }

  socket.on("rejoin_game", factoryRejoinGameHandler(socket));
  socket.on("join_game", factoryJoinGameHandler(io, socket));
  socket.on("leave_game", factoryLeaveGameHandler(io, socket));
};
