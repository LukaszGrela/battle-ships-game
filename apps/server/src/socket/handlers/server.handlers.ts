import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import { factoryDisconnectHandler } from "./socket.handlers.impl/disconnect";
import { factoryGetDisconnectFromServerHandler } from "./socket.handlers.impl/disconnect_from_server";
import { getRoomsHandler } from "./socket.handlers.impl/get_rooms";
import { getWarRoomNameHandler } from "./socket.handlers.impl/get_war_room_name";
import { getStatsHandler } from "./socket.handlers.impl/get_stats";

export const registerServerHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  //
  socket.on("get_rooms", getRoomsHandler);
  socket.on("get_war_room_name", getWarRoomNameHandler);

  // user used disconnect button
  socket.on(
    "disconnect_from_server",
    factoryGetDisconnectFromServerHandler(socket),
  );

  // user has disonnected for some other reason
  socket.on("disconnect", factoryDisconnectHandler(io, socket));

  socket.on("get_stats", getStatsHandler);
};
