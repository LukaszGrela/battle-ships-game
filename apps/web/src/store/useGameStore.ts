import { createEmptyBoard } from "@repo/game-logic";
import { ECellStatus, TGameState } from "@repo/types";
import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";

type TGameStoreActions = {
  setSelfId: (id: string | null) => void;
  setGameState: (state: TGameState | null) => void;
  setError: (message: string | null) => void;
};

type TGameStore = {
  gameState: TGameState | null;
  selfId: string | null;
  errorMessage: string | null;
} & TGameStoreActions;

export const useGameStore = create<TGameStore>((set) => ({
  setSelfId: (id) => set({ selfId: id }),
  setGameState: (gameState) => set({ gameState }),
  setError: (message) => set({ errorMessage: message }),
  selfId: null,
  errorMessage: null,
  gameState: null,
}));

export const useSocketGameState = () => {
  const { setGameState, setError, setSelfId } = useGameStore();
  useEffect(() => {
    function onUpdate(state: TGameState | null) {
      setGameState(state);
      if (state === null) {
        setSelfId(null);
        setError(null);
      }
    }

    function onWelcome(userId: string) {
      setSelfId(userId);
    }

    function onError(message: string | null) {
      setError(message);
    }

    socket.on("game_updated", onUpdate);
    socket.on("welcome", onWelcome);
    socket.on("error", onError);

    return () => {
      socket.off("game_updated", onUpdate);
      socket.off("welcome", onWelcome);
      socket.off("error", onError);
    };
  }, [setError, setGameState, setSelfId]);
};
