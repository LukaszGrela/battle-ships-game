import styles from "./Game.module.css";
import { FC, useCallback, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { TInteractivityProps } from "../components/Board";
import { ECellStatus, TCoordinate, TPlacedShip } from "@repo/types";
import { socket } from "../socket";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";
import { OpponentTurnModal } from "../components/OpponentTurnModal";
import { AttackModal } from "../components/AttackModal/AttackModal";
import { TurnIndicator } from "../components/TurnIndicator/TurnIndicator";

export const Game: FC = () => {
  const { gameState, selfId } = useGameStore();

  const myTurn = gameState?.turn === selfId;

  const [attacking, setAttacking] = useState<TCoordinate | null>(null);
  const [attackResult, setAttackResult] = useState<ECellStatus | null>(null);
  const handleAttack = useCallback(async (coords: TCoordinate) => {
    setAttacking(coords);
    try {
      const result = await socket.emitWithAck("attack_coordinate", coords);
      if (!result.ok) throw result;

      setAttackResult(result.status);
    } catch (error) {
      console.error(error);
      setAttacking(null);
      setAttackResult(null);
    }
  }, []);

  const attackInteractivity: TInteractivityProps & { disabled?: boolean } =
    useMemo(() => {
      if (gameState?.phase === "playing") {
        return {
          isInteractive: true,
          onClick: handleAttack,
          disabled: !myTurn,
        };
      }
      return {
        isInteractive: false,
      };
    }, [gameState?.phase, myTurn, handleAttack]);

  return (
    <AppLayout
      header={
        gameState && (
          <GameHeader
            gameState={gameState as TGameHeaderAllowedState}
            showForfait
          />
        )
      }
    >
      {gameState?.phase === "playing" && (
        <TurnIndicator className={styles.turnIndicator}>
          {myTurn ? "Your turn" : "Opponents turn"}
        </TurnIndicator>
      )}
      <section className={styles.Game_layout}>
        {gameState &&
          (gameState.phase === "playing" || gameState.phase === "finished") && (
            <ShipsBoard
              className={styles.left}
              board={gameState.myBoard}
              owner={!!gameState.self.owner}
              ships={gameState.ships as TPlacedShip[]}
            />
          )}
        {gameState && gameState.phase === "playing" && (
          <>
            <ShipsBoard
              className={styles.right}
              board={gameState.enemyBoard}
              owner={!!gameState?.self.owner === false}
              ships={gameState.enemyDestroyedShips as TPlacedShip[]}

              {...attackInteractivity}
            />
          </>
        )}
      </section>

      <OpponentTurnModal
        open={!myTurn && !attacking}
        player={(gameState as TGameHeaderAllowedState).enemy}
      />

      <AttackModal
        attack={!!attacking}
        open={!!attacking}
        result={attackResult}
        onClose={() => {
          setAttacking(null);
          setAttackResult(null);
        }}
      />
    </AppLayout>
  );
};
