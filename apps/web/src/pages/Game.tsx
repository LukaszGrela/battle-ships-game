import styles from "./Game.module.css";
import { FC, useMemo } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { BoardGrid, TInteractivityProps } from "../components/Board";
import { PlayerDetails } from "../components/PlayerDetails/PlayerDetails";
import { TCoordinate } from "@repo/types";
import { socket } from "../socket";

export const Game: FC = () => {
  const { gameState, selfId } = useGameStore();
  const playerId = selfId ?? "";
  console.log(gameState);

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
    <AppLayout>
      <h2>Game</h2>
      <section>{gameState?.phase}</section>
      <PlayerDetails id={playerId} name={gameState?.self.name ?? ""} />
      {gameState?.phase === "playing" && (
        <section>Tura: {myTurn ? "Twoja kolej" : "Kolej przeciwnika"}</section>
      )}
      <section className={styles.Game_layout}>
        <BoardGrid board={gameState?.myBoard ?? []} heading={"Twoja flota"} />
        {gameState &&
          (gameState.phase === "playing" || gameState.phase === "finished") && (
            <BoardGrid
              board={gameState.enemyBoard}
              heading="Flota wroga"
              {...attackInteractivity}
            />
          )}
      </section>
    </AppLayout>
  );
};
