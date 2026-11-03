import styles from "./Game.module.css";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { TInteractivityProps } from "../components/Board";
import {
  TAttackResult,
  TCellStatusShipDestroyed,
  TCoordinate,
  TGameState,
  THistoryEntry,
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
import { isDestroyedShipStatus } from "@repo/game-logic";

const isDestroyedAttackResult = (
  result: TAttackResult,
): result is Extract<
  TAttackResult,
  { ok: true; status: TCellStatusShipDestroyed; size: number }
> => result.ok && isDestroyedShipStatus(result.status);

const isPlayingGameState = (
  gameState: TGameState | null,
): gameState is TGameState & { phase: "playing" } => {
  return !!(gameState && gameState.phase === "playing");
};

const isInitAttackHistory = (
  test: THistoryEntry | null | undefined,
): test is Extract<THistoryEntry, { init: true }> => {
  return (
    !!test && Object.hasOwn(test, "init") && (test as { init: boolean }).init
  );
};

export const Game: FC = () => {
  const { gameState, selfId } = useGameStore();

  const playingState = isPlayingGameState(gameState) ? gameState : null;

  const myTurn = gameState?.turn === selfId;
  const lastAttack = playingState?.lastAttack;
  const currentAttack = useMemo(() => !!lastAttack === false, [lastAttack]);

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
    if (lastAttack) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAttacking(true);
      const attackResult: TAttackResult = {
        ok: true,
        status: lastAttack.result,
        size: lastAttack.size,
      };
      setAttackResult(attackResult);
    }
  }, [lastAttack]);

  const shipSize =
    attackResult && isDestroyedAttackResult(attackResult)
      ? attackResult.size
      : 0;

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
        open={attacking && !isInitAttackHistory(lastAttack)}
        result={attackResult && attackResult.ok ? attackResult.status : null}
        shipSize={shipSize}
        onClose={() => {
          setAttacking(false);
          setAttackResult(null);
        }}
      />
    </AppLayout>
  );
};
