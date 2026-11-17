import {
  IClientToServerEvents,
  IServerToClientEvents,
  TStats,
} from "@repo/types";
import { Server } from "socket.io";
import ActiveUsersServiceSingleton from "../services/users.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import GameStatsServiceSingleton from "../services/game-stats.service";

export const getStats = (): TStats => {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  return {
    activePlayers: ActiveUsersServiceSingleton.getInstance().countUsers(),
    activeGames: activeGameRegistry.activeGames(),
    // Lifetime counter from the append-only statistics store. It does not
    // depend on rooms still living in the registry, so deleting a finished
    // room (leave, rematch timeout, finished-room TTL) never decreases it.
    playedGames: GameStatsServiceSingleton.getInstance().playedGames(),
  };
};

export const emitStats = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
) => {
  io.emit("server_stats", getStats());
};
