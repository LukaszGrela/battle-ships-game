import {
  IClientToServerEvents,
  IServerToClientEvents,
  TStats,
} from "@repo/types";
import { Server } from "socket.io";
import RoomServiceSingleton from "../services/room.service";
import ActiveUsersServiceSingleton from "../services/users.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";

export const getStats = (): TStats => {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  console.log("TODO: getStats", {
    activePlayers: ActiveUsersServiceSingleton.getInstance().countUsers(),
    activeGames: activeGameRegistry.activeGames(),
    playedGames: activeGameRegistry.playedGames(),
  });
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
