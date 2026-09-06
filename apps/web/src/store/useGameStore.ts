import { createEmptyBoard } from "@repo/game-logic";
import { ECellStatus, TGameState } from "@repo/types";
import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";

interface IGameStore {
  selfId: string | null;
  setSelfId: (id: string | null) => void;
  gameState: TGameState | null;
  myBoard: ECellStatus[][];
  attackBoard: ECellStatus[][];

  setGameState: (state: TGameState) => void;

  errorMessage: string | null;
  setError: (message: string | null) => void;
}

export const useGameStore = create<IGameStore>((set) => ({
  gameState: null,
  selfId: null,
  setSelfId: (id) => set({ selfId: id }),
  myBoard: createEmptyBoard(),
  attackBoard: createEmptyBoard(),
  setGameState: (gameState) => set({ gameState }),
  errorMessage: null,
  setError: (message) => set({ errorMessage: message }),
}));

export const useSocketGameState = () => {
  const { setGameState, setError, setSelfId } = useGameStore();
  useEffect(() => {
    function onUpdate(state: TGameState) {
      setGameState(state);
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
