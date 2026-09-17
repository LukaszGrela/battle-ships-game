import styles from "./Game.module.css";

import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { Button } from "../components/Button/Button";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import { TPlacedShip } from "@repo/types";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";
import { EmitLeaveGameButton } from "../components/EmitLeaveGameButton/EmitLeaveGameButton";

export const GameOver: FC = () => {
  const { gameState } = useGameStore();
  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];

  return (
    <AppLayout
      header={
        gameState && (
          <GameHeader gameState={gameState as TGameHeaderAllowedState} />
        )
      }
    >
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

        <EmitLeaveGameButton type="secondary">
          Exit to Lobby
        </EmitLeaveGameButton>
      </section>
    </AppLayout>
  );
};
