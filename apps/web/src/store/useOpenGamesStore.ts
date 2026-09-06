import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";

interface IOpenGamesData {
  openGames: string[];
}
interface IOpenGamesAction {
  setOpenGames: (warRoomNames: string[]) => void;
}

export const useOpenGamesStore = create<IOpenGamesData & IOpenGamesAction>(
  (set) => ({
    openGames: [],
    setOpenGames: (warRoomNames: string[]) =>
      set({
        openGames: warRoomNames,
      }),
  }),
);

export const useOpenGamesStatus = () => {
  const { setOpenGames } = useOpenGamesStore();

  useEffect(() => {
    function lobby(rooms: string[]) {
      console.log("useOpenGamesStatus", rooms);
      setOpenGames(rooms);
    }

    socket.on("open_games", lobby);

    return () => {
      socket.off("open_games", lobby);
    };
  }, [setOpenGames]);
};
