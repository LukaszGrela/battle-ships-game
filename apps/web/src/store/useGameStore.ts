import {
  EGamePhase,
  IPlayer,
  TAttackHistory,
  TGameState,
  TRematchRequest,
} from "@repo/types";
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

  setAttackHistory: (history?: TAttackHistory) => void;
};

type TGameStore = {
  gameState: TGameState | null;
  selfId: string | null;
  errorMessage: string | null;

  revengeRequest?: TRematchRequest;

  attackHistory?: TAttackHistory;
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

  setAttackHistory: (history) => set({ attackHistory: history }),

  selfId: null,
  errorMessage: null,
  gameState: null,
  attackHistory: undefined,
}));

export const useSocketGameState = () => {
  const {
    setGameState,
    setError,
    setSelfId,
    setEnemyReady,
    setRematchRequest,
    setEnemyLeft,
    setAttackHistory,
  } = useGameStore();
  useEffect(() => {
    function onUpdate(state: TGameState | null) {
      setGameState(state);
      if (state === null) {
        setSelfId(null);
        setError(null);
        setRematchRequest(undefined);
        setAttackHistory(undefined);
      } else {
        if (state.phase === "playing") {
          setAttackHistory(state.lastAttack);
        } else {
          setAttackHistory(undefined);
        }

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
      setEnemyReady(player);
    };
    const playerLeftCallback = (
      player?: Pick<IPlayer, "id" | "name" | "seed">,
    ) => {
      setEnemyLeft(player);
    };

    const opponentRequestRematchHandler = (request: TRematchRequest) => {
      setRematchRequest(request);
    };

    const rematchCancelledHandler = (payload: {
      requestorId: string;
      status: "cancelled";
      reason: "cancelled" | "timeout";
    }) => {
      const current = useGameStore.getState().revengeRequest;
      if (!current || current.requestorId !== payload.requestorId) return;

      setRematchRequest({
        ...current,
        status: "cancelled",
        cancelledReason: payload.reason,
      });
    };

    socket.on("player_ready", playerReadyCallback);
    socket.on("player_left", playerLeftCallback);

    socket.on("game_updated", onUpdate);
    socket.on("welcome", onWelcome);
    socket.on("error", onError);
    socket.on("rematch_requested", opponentRequestRematchHandler);
    socket.on("rematch_cancelled", rematchCancelledHandler);

    return () => {
      socket.off("game_updated", onUpdate);
      socket.off("welcome", onWelcome);
      socket.off("error", onError);
      socket.off("player_ready", playerReadyCallback);
      socket.off("player_left", playerLeftCallback);
      socket.off("rematch_requested", opponentRequestRematchHandler);
      socket.off("rematch_cancelled", rematchCancelledHandler);
    };
  }, [
    setAttackHistory,
    setEnemyLeft,
    setEnemyReady,
    setError,
    setGameState,
    setRematchRequest,
    setSelfId,
  ]);
};
