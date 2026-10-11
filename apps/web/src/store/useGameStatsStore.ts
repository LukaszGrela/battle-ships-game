import { TStats } from "@repo/types";
import { create } from "zustand";
import { socket } from "../socket";
import { useEffect } from "react";

type TGameStatsStore = TStats & {
  setStats: (stats: TStats) => void;
};

export const useGameStatsStore = create<TGameStatsStore>((set) => ({
  activeGames: 0,
  activePlayers: 0,
  playedGames: 0,
  setStats: (stats) =>
    set(() => ({
      activeGames: stats.activeGames,
      activePlayers: stats.activePlayers,
      playedGames: stats.playedGames,
    })),
}));

export const useSocketGameStats = () => {
  const { setStats } = useGameStatsStore();

  useEffect(() => {
    const handleServerStats = (stats: TStats) => {
      setStats(stats);
    };

    socket.emitWithAck("get_stats").then(setStats);
    socket.on("server_stats", handleServerStats);
    return () => {
      socket.off("server_stats", handleServerStats);
    };
  }, [setStats]);
};
