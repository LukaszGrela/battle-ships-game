import {
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import { factoryAttackCoordinateHandler } from "./socket.handlers.impl/attack_coordinate";
import { factoryPlaceShipsHandler } from "./socket.handlers.impl/place_ships";

export const registerGameHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  socket.on("place_ships", factoryPlaceShipsHandler(io, socket));
  socket.on("attack_coordinate", factoryAttackCoordinateHandler(io, socket));
};
