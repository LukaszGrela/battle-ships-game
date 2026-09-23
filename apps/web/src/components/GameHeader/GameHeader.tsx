import styles from "./GameHeader.module.css";
import { FC } from "react";
import { EGamePhase, TGameState } from "@repo/types";
import { PlayerDetails } from "../PlayerDetails/PlayerDetails";
import { EmitLeaveGameButton } from "../EmitLeaveGameButton/EmitLeaveGameButton";
import { LifeBuoy } from "../icons/LifeBuoy";
import { Flag } from "../icons/Flag";
import { EmitForfeitGameButton } from "../EmitForfaitGameButton/EmitForfaitGameButton";

export type TGameHeaderAllowedState = TGameState & {
  phase: EGamePhase.Placement | EGamePhase.Playing | EGamePhase.Finished;
};
export const GameHeader: FC<{
  gameState: TGameHeaderAllowedState;
  showForfait?: boolean;
  showAbandon?: boolean;
}> = ({ gameState, showAbandon, showForfait }) => {
  return (
    <div className={styles.GameHeader}>
      <div className={styles.GameHeader_toolbar}>
        {showAbandon && (
          <EmitLeaveGameButton
            size="sm"
            type="danger"
            className={styles.responsiveIconButton}
          >
            <LifeBuoy />
            <span>Abandon game</span>
          </EmitLeaveGameButton>
        )}
        {showForfait && (
          <EmitForfeitGameButton
            size="sm"
            type="danger"
            className={styles.responsiveIconButton}
          >
            <Flag />
            <span>Forfait</span>
          </EmitForfeitGameButton>
        )}
      </div>
      <div className={styles.GameHeader_content}>
        {gameState && (
          <PlayerDetails
            self={gameState.self}
            phase={gameState.phase}
            className={styles.home}
          />
        )}
        <img
          alt="Pirates - BattleShips"
          src="./title.png"
          className={styles.Header_title}
        />
        {gameState && (
          <PlayerDetails
            className={styles.away}
            self={gameState.enemy}
            enemy
            phase={gameState.phase}
          />
        )}
      </div>
    </div>
  );
};
