import { IClientToServerEvents, IServerToClientEvents, TStats } from "@repo/types";
import { Server, Socket } from "socket.io";
import RoomServiceSingleton from "../services/room.service";
import ActiveUsersServiceSingleton from "../services/users.service";

const stats = (): TStats => {
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
  io.emit("server_stats", stats());
};
