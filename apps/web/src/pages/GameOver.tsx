import styles from "./Game.module.css";

import { FC, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import { TPlacedShip } from "@repo/types";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";
import { GameResultsModal } from "../components/GameResultsModal";

export const GameOver: FC = () => {
  const { gameState } = useGameStore();

  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];
  const winner = myResults === "win";

  const [open, setOpen] = useState(true);
  const closeModal = () => {
    setOpen(false);
  };

  return (
    <AppLayout
      header={
        gameState && (
          <GameHeader
            gameState={gameState as TGameHeaderAllowedState}
            showRevenge={!winner}
            showLeave
          />
        )
      }
    >
      <section className={styles.Game_layout}>
        {gameState &&
          (gameState.phase === "playing" || gameState.phase === "finished") && (
            <ShipsBoard
              board={gameState.myBoard}
              owner={!!gameState.self.owner}
              ships={gameState.ships as TPlacedShip[]}
            />
          )}
        {gameState && gameState.phase === "finished" && (
          <>
            <ShipsBoard
              board={gameState.enemyBoard}
              owner={!!gameState?.self.owner === false}
              ships={gameState.enemyDestroyedShips as TPlacedShip[]}
            />
          </>
        )}
      </section>
      {gameState && (
        <GameResultsModal
          gameState={gameState}
          open={open}
          onClose={closeModal}
        />
      )}
    </AppLayout>
  );
};
