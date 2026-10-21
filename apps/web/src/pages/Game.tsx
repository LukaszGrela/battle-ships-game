import styles from "./Game.module.css";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { TInteractivityProps } from "../components/Board";
import {
  ECellStatus,
  TAttackResult,
  TCoordinate,
  TPlacedShip,
} from "@repo/types";
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

  const currentAttack = useMemo(
    () =>
      !!(gameState && gameState.phase === "playing" && gameState.lastAttack) ===
      false,
    [gameState],
  );
  const [attacking, setAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState<TAttackResult | null>(null);
  const handleAttack = useCallback(async (coords: TCoordinate) => {
    setAttacking(true);
    try {
      const result = await socket.emitWithAck("attack_coordinate", coords);
      if (!result.ok) throw result;

      setAttackResult(result);
    } catch (error) {
      console.error(error);
      setAttacking(false);
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

  useEffect(() => {
    if (gameState && gameState.phase === "playing" && gameState.lastAttack) {
      const { lastAttack } = gameState;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttacking(true);
      const attackResult: TAttackResult = {
        ok: true,
        status: lastAttack.isSunk
          ? ECellStatus.Destroyed
          : (lastAttack.result as ECellStatus.Hit | ECellStatus.Miss),
        size: lastAttack.size,
      };
      setAttackResult(attackResult);
    }
  }, [gameState]);

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
        attack={currentAttack}
        open={attacking}
        result={attackResult && attackResult.ok ? attackResult.status : null}
        shipSize={
          attackResult &&
          attackResult.ok &&
          attackResult.status === ECellStatus.Destroyed
            ? attackResult.size
            : 0
        }
        onClose={() => {
          setAttacking(false);
          setAttackResult(null);
        }}
      />
    </AppLayout>
  );
};
