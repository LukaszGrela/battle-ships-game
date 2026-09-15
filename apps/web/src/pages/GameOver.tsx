import styles from "./Game.module.css";

import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { Button } from "../components/Button/Button";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import { TPlacedShip } from "@repo/types";

export const GameOver: FC = () => {
  const { gameState } = useGameStore();
  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];

  return (
    <AppLayout>
      <h2>Game Over</h2>
      {myResults && (
        <section>{myResults === "win" ? "Wygrałeś!" : "Przegrałeś!"}</section>
      )}
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
      <section>
        <Button>Zaproponuj rewanż</Button>
        <Button style="secondary">Zakoncz gre</Button>
      </section>
    </AppLayout>
  );
};
