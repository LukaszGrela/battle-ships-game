import { Server, Socket } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";

import { factoryJoinGameHandler } from "./socket.handlers.impl/join_game";
import { factoryLeaveGameHandler } from "./socket.handlers.impl/leave_game";

export const registerRoomHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  socket.on("join_game", factoryJoinGameHandler(io, socket));
  socket.on("leave_game", factoryLeaveGameHandler(io, socket));
};
