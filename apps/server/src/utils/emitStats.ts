import {
  IClientToServerEvents,
  IServerToClientEvents,
  TStats,
} from "@repo/types";
import { Server } from "socket.io";
import RoomServiceSingleton from "../services/room.service";
import ActiveUsersServiceSingleton from "../services/users.service";

export const getStats = (): TStats => {
  const roomService = RoomServiceSingleton.getInstance();
  return {
    activePlayers: ActiveUsersServiceSingleton.getInstance().countUsers(),
    activeGames: roomService.activeGames(),
    playedGames: roomService.playedGames(),
  };
};

export const emitStats = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
) => {
  io.emit("server_stats", getStats());
};
