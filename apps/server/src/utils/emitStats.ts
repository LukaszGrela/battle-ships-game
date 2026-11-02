import {
  IClientToServerEvents,
  IServerToClientEvents,
  TStats,
} from "@repo/types";
import { Server } from "socket.io";
import ActiveUsersServiceSingleton from "../services/users.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";

export const getStats = (): TStats => {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  return {
    activePlayers: ActiveUsersServiceSingleton.getInstance().countUsers(),
    activeGames: activeGameRegistry.activeGames(),
    playedGames: activeGameRegistry.playedGames(),
  };
};

export const emitStats = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
) => {
  io.emit("server_stats", getStats());
};
