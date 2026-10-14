import styles from "./Game.module.css";

import { FC, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import { TPlacedShip } from "@repo/types";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";
import { GameResultsModal } from "../components/GameResultsModal";
import { RematchRequestSentModal } from "../components/request-rematch/RematchRequestSentModal";
import { ConfirmRematchModal } from "../components/request-rematch/ConfirmRematchModal";

export const GameOver: FC = () => {
  const { gameState, revengeRequest } = useGameStore();

  console.log("[GameOver] gameState", gameState);

  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];
  const winner = myResults === "win";
  const opponentActive = !!state?.enemy.active;

  const requestRematchStatus = revengeRequest?.status;
  const isRequestor = revengeRequest?.requestorId === state?.self.id;

  const [open, setOpen] = useState(
    isRequestor && requestRematchStatus === "pending" ? false : true,
  );
  const closeModal = () => {
    setOpen(false);
  };

  return (
    <AppLayout
      header={
        gameState && (
          <GameHeader
            gameState={gameState as TGameHeaderAllowedState}
            showRevenge={!winner}
            showLeave
          />
        )
      }
    >
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
      {gameState && (
        <GameResultsModal
          gameState={gameState}
          open={open}
          onClose={closeModal}
        />
      )}
      {requestRematchStatus && (
        <>
          {/* If requestor show pending modal */}
          <RematchRequestSentModal
            open={
              requestRematchStatus === "pending" &&
              isRequestor &&
              opponentActive
            }
          />
          {/* If requestee (!requestor) and pending show confirm modal */}
          <ConfirmRematchModal
            open={
              requestRematchStatus === "pending" &&
              !isRequestor &&
              opponentActive
            }
            request={revengeRequest}
          />
        </>
      )}
    </AppLayout>
  );
};
