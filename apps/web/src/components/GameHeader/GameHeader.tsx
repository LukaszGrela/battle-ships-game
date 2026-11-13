import styles from "./GameHeader.module.css";
import { FC } from "react";
import { EGamePhase, TGameState } from "@repo/types";
import { PlayerDetails } from "../PlayerDetails/PlayerDetails";
import { EmitLeaveGameButton } from "../EmitLeaveGameButton/EmitLeaveGameButton";
import { LifeBuoy } from "../icons/LifeBuoy";
import { Flag } from "../icons/Flag";
import { EmitForfeitGameButton } from "../EmitForfaitGameButton/EmitForfaitGameButton";
import { RequestRematchButton } from "../RequestRematchButton/RequestRematchButton";

export type TGameHeaderAllowedState = TGameState & {
  phase: EGamePhase.Placement | EGamePhase.Playing | EGamePhase.Finished;
};
export const GameHeader: FC<{
  gameState: TGameHeaderAllowedState;
  showForfait?: boolean;
  showAbandon?: boolean;
  showRevenge?: boolean;
  showLeave?: boolean;
}> = ({ gameState, showAbandon, showForfait, showLeave, showRevenge }) => {
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
        {showRevenge && <RequestRematchButton size="sm" />}
        {showLeave && (
          <EmitLeaveGameButton
            size="sm"
            type="secondary"
            skipConfirmation={true}
          >
            Sail Away
          </EmitLeaveGameButton>
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
          src="/assets/title-120.png"
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
