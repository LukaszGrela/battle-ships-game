import { FC, useMemo } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { AvailableShips } from "../components/AvailableShips/AvailableShips";
import { BoardGrid } from "../components/Board/BoardGrid";
import { TInteractivityProps } from "../components/Board/types";
import { PlayerDetails } from "../components/PlayerDetails/PlayerDetails";

export const Game: FC = () => {
  const { gameState, selfId, myBoard, attackBoard } = useGameStore();
  const playerId = selfId ?? "";
  console.log(gameState);

  const myTurn = gameState?.turn === selfId;

  const attackInteractivity: TInteractivityProps & { disabled?: boolean } =
    useMemo(() => {
      if (gameState?.phase === "playing") {
        return {
          isInteractive: true,
          onClick: console.log,
          disabled: !myTurn,
        };
      }
      return {
        isInteractive: false,
      };
    }, [gameState?.phase, myTurn]);

  const placementInteractivity: TInteractivityProps = useMemo(() => {
    if (gameState?.phase === "placement") {
      return {
        isInteractive: true,
        onClick: console.log,
      };
    }
    return {
      isInteractive: false,
    };
  }, [gameState?.phase]);
  return (
    <AppLayout>
      <h2>Game </h2>
      <section>{gameState?.phase}</section>
      <PlayerDetails selfId={playerId} />
      {gameState?.phase === "playing" && (
        <section>Tura: {myTurn ? "Twoja kolej" : "Kolej przeciwnika"}</section>
      )}
      <section>
        <BoardGrid
          board={myBoard}
          heading={
            gameState?.phase !== "placement" ? "Twoja flota" : "Ustaw statki"
          }
          {...placementInteractivity}
        />
        {gameState?.phase !== "placement" && (
          <BoardGrid
            board={attackBoard}
            heading="Flota wroga"
            {...attackInteractivity}
          />
        )}
      </section>
      {gameState?.phase === "placement" && (
        <AvailableShips shipsLeft={gameState.shipsLeft} />
      )}
    </AppLayout>
  );
};
