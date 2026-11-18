import styles from "./Game.module.css";
import { FC, useCallback, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { TInteractivityProps } from "../components/Board";
import {
  TAttackHistory,
  TAttackResult,
  TCellStatusShipDestroyed,
  TCoordinate,
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

const isInitAttackHistory = (
  test: THistoryEntry | null | undefined,
): test is Extract<THistoryEntry, { init: true }> => {
  return (
    !!test && Object.hasOwn(test, "init") && (test as { init: boolean }).init
  );
};

export const Game: FC = () => {
  const { gameState, selfId } = useGameStore();

  const myTurn = gameState?.turn === selfId;

  const [attackResult, setAttackResult] = useState<TAttackResult | null>(null);
  const handleAttack = useCallback(async (coords: TCoordinate) => {
    try {
      const result = await socket.emitWithAck("attack_coordinate", coords);
      if (!result.ok) throw result;

      setAttackResult(result);
    } catch (error) {
      console.error(error);
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
        open={!myTurn && !attackResult}
        player={(gameState as TGameHeaderAllowedState).enemy}
      />

      <AttackResult
        attackResult={attackResult}
        clearAttackResult={() => setAttackResult(null)}
      />
    </AppLayout>
  );
};

const guardTAttackHistory = (test: unknown): test is TAttackHistory => {
  return (
    typeof test === "object" &&
    test !== null &&
    "turn" in test &&
    "result" in test
  );
};

const isDestroyedAttackResult = (
  result: unknown,
): result is Extract<
  TAttackResult,
  { ok: true; status: TCellStatusShipDestroyed; size: number }
> =>
  typeof result === "object" &&
  result != null &&
  "ok" in result &&
  "status" in result &&
  (result as TAttackResult).ok &&
  isDestroyedShipStatus((result as TAttackResult & { ok: true }).status);

const getShipSize = (
  result?: TAttackResult | TAttackHistory | null,
): number => {
  if (guardTAttackHistory(result) && result.isSunk) {
    return result.size;
  } else if (result && isDestroyedAttackResult(result)) {
    return result.size;
  }

  return 0;
};
const getResult = (result?: TAttackResult | TAttackHistory | null) => {
  if (result && guardTAttackHistory(result)) {
    return result.result;
  }

  if (result && result.ok) {
    return result.status;
  }

  return null;
};

const AttackResult: FC<{
  // current player attack result
  attackResult?: TAttackResult | null;
  clearAttackResult: () => void;
}> = ({ attackResult, clearAttackResult }) => {
  const { selfId, attackHistory, setAttackHistory } = useGameStore();
  // lastAttack trafia też do atakującego, gdy tura zostaje przy nim po trafieniu
  const enemyHistory =
    attackHistory && attackHistory.turn !== selfId ? attackHistory : undefined;

  const [key, setKey] = useState(0);
  const shipSize = useMemo(
    () => getShipSize(attackResult) || getShipSize(enemyHistory),
    [enemyHistory, attackResult],
  );

  const handleCloseModal = useCallback(() => {
    setKey((state) => state + 1);
    if (attackResult) {
      clearAttackResult();
    } else {
      setAttackHistory(undefined);
    }
  }, [attackResult, clearAttackResult, setAttackHistory]);

  const open = !!attackResult || !!enemyHistory;
  const result = useMemo(
    () => getResult(attackResult) ?? getResult(enemyHistory),
    [enemyHistory, attackResult],
  );

  return (
    <AttackModal
      key={key}
      currentAttack={!!attackResult}
      open={open && !isInitAttackHistory(enemyHistory)}
      result={result}
      shipSize={shipSize}
      onClose={handleCloseModal}
    />
  );
};
