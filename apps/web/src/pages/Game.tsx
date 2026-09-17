import styles from "./Game.module.css";
import { FC, useMemo } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { TInteractivityProps } from "../components/Board";
import { TCoordinate, TPlacedShip } from "@repo/types";
import { socket } from "../socket";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";

export const Game: FC = () => {
  const { gameState, selfId } = useGameStore();

  const myTurn = gameState?.turn === selfId;

  const attackInteractivity: TInteractivityProps & { disabled?: boolean } =
    useMemo(() => {
      if (gameState?.phase === "playing") {
        return {
          isInteractive: true,
          onClick: (coords: TCoordinate) => {
            socket.emit("attack_coordinate", coords);
          },
          disabled: !myTurn,
        };
      }
      return {
        isInteractive: false,
      };
    }, [gameState?.phase, myTurn]);

  return (
    <AppLayout
      header={
        gameState && (
          <GameHeader gameState={gameState as TGameHeaderAllowedState} />
        )
      }
    >
      {gameState?.phase === "playing" && (
        <section>Tura: {myTurn ? "Twoja kolej" : "Kolej przeciwnika"}</section>
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
        {gameState && gameState.phase === "playing" && (
          <>
            <ShipsBoard
              board={gameState.enemyBoard}
              owner={!!gameState?.self.owner === false}
              ships={gameState.enemyDestroyedShips as TPlacedShip[]}

              {...attackInteractivity}
            />
          </>
        )}
      </section>
    </AppLayout>
  );
};
