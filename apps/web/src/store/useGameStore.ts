import { EGamePhase, IPlayer, TGameState, TRematchRequest } from "@repo/types";
import { useEffect } from "react";
import { create } from "zustand";
import { socket } from "../socket";

type TGameStoreActions = {
  setSelfId: (id: string | null) => void;
  setGameState: (state: TGameState | null) => void;
  setError: (message: string | null) => void;

  setEnemyReady: (enemy: Pick<IPlayer, "name" | "seed" | "owner">) => void;
  setEnemyLeft: (enemy?: Pick<IPlayer, "id" | "name" | "seed">) => void;
  setRematchRequest: (request: TRematchRequest | undefined) => void;
};

type TGameStore = {
  gameState: TGameState | null;
  selfId: string | null;
  errorMessage: string | null;

  revengeRequest?: TRematchRequest;
} & TGameStoreActions;

export const useGameStore = create<TGameStore>((set) => ({
  setSelfId: (id) => set({ selfId: id }),
  setGameState: (gameState) => set({ gameState }),
  setError: (message) => set({ errorMessage: message }),
  setEnemyReady: (enemy: Pick<IPlayer, "name" | "seed" | "owner">) =>
    set(
      (state) =>
        ({
          gameState: {
            ...state.gameState,
            enemy:
              state.gameState && state.gameState.phase !== "waiting"
                ? {
                    ...state.gameState.enemy,
                    ...enemy,
                  }
                : enemy,
          },
        }) as TGameStore & { phase: EGamePhase.Placement },
    ),

  setRematchRequest: (request) => set({ revengeRequest: request }),

  setEnemyLeft: (enemy?: Pick<IPlayer, "id" | "name" | "seed">) =>
    set(
      (state) =>
        ({
          gameState: {
            ...state.gameState,
            enemy:
              state.gameState && state.gameState.phase !== "waiting"
                ? {
                    ...state.gameState.enemy,
                    ...enemy,
                    active: false,
                  }
                : {
                    ...enemy,
                    active: false,
                  },
          },
        }) as TGameStore & { phase: EGamePhase.Placement },
    ),

  selfId: null,
  errorMessage: null,
  gameState: null,
}));

export const useSocketGameState = () => {
  const {
    setGameState,
    setError,
    setSelfId,
    setEnemyReady,
    setRematchRequest,
    setEnemyLeft,
  } = useGameStore();
  useEffect(() => {
    function onUpdate(state: TGameState | null) {
      console.log("[useGameStore.onUpdate]", state);

      setGameState(state);
      if (state === null) {
        setSelfId(null);
        setError(null);
        setRematchRequest(undefined);
      } else {
        setRematchRequest(state.rematchRequest);
      }
    }

    function onWelcome(userId: string) {
      setSelfId(userId);
    }

    function onError(message: string | null) {
      console.error("[useGameStore.onError]", message);
      setError(message);
    }
    const playerReadyCallback = (
      player: Pick<IPlayer, "id" | "name" | "seed" | "owner">,
    ) => {
      console.log(`Player ${player.name} is ready!`);
      setEnemyReady(player);
    };
    const playerLeftCallback = (
      player?: Pick<IPlayer, "id" | "name" | "seed">,
    ) => {
      console.log(`Player ${player?.name} has left the game!`);
      setEnemyLeft(player);
    };

    const opponentRequestRematchHandler = (request: TRematchRequest) => {
      console.log("[useGameStore.opponentRequestRematchHandler]", request);
      setRematchRequest(request);
    };

    socket.on("player_ready", playerReadyCallback);
    socket.on("player_left", playerLeftCallback);

    socket.on("game_updated", onUpdate);
    socket.on("welcome", onWelcome);
    socket.on("error", onError);
    socket.on("rematch_requested", opponentRequestRematchHandler);

    return () => {
      socket.off("game_updated", onUpdate);
      socket.off("welcome", onWelcome);
      socket.off("error", onError);
      socket.off("player_ready", playerReadyCallback);
      socket.off("player_left", playerLeftCallback);
      socket.off("rematch_requested", opponentRequestRematchHandler);
    };
  }, [
    setEnemyLeft,
    setEnemyReady,
    setError,
    setGameState,
    setRematchRequest,
    setSelfId,
  ]);
};
