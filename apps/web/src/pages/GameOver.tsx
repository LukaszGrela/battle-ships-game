import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { Button } from "../components/Button/Button";

export const GameOver: FC = () => {
  const { gameState, selfId } = useGameStore();
  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];
  const enemyResults = state?.result[state.enemy.id];

  return (
    <AppLayout>
      <h2>Game Over</h2>
      <section>{myResults === "win" && "Wygrałeś!"}</section>
      <section>{myResults === "lost" && "Przegrałeś!"}</section>
      <section>
        <Button>Zaproponuj rewanż</Button>
        <Button style="secondary">Zakoncz gre</Button>
      </section>
    </AppLayout>
  );
};
