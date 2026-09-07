import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";
import { TRoomIdentity } from "@repo/types";

interface IOpenGamesData {
  openGames: TRoomIdentity[];
}
interface IOpenGamesAction {
  setOpenGames: (warRoomNames: TRoomIdentity[]) => void;
}

export const useOpenGamesStore = create<IOpenGamesData & IOpenGamesAction>(
  (set) => ({
    openGames: [],
    setOpenGames: (warRoomNames: TRoomIdentity[]) =>
      set({
        openGames: warRoomNames,
      }),
  }),
);

export const useOpenGamesStatus = () => {
  const { setOpenGames } = useOpenGamesStore();

  useEffect(() => {
    function lobby(rooms: TRoomIdentity[]) {
      console.log("useOpenGamesStatus", rooms);
      setOpenGames(rooms);
    }

    socket.on("open_games", lobby);

    return () => {
      socket.off("open_games", lobby);
    };
  }, [setOpenGames]);
};
