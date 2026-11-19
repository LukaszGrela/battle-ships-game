import styles from "./GameHeader.module.css";
import { FC } from "react";
import { EGamePhase, TGameState } from "@repo/types";
import { PlayerDetails } from "../PlayerDetails/PlayerDetails";
import { EmitLeaveGameButton } from "../EmitLeaveGameButton/EmitLeaveGameButton";
import { LifeBuoy } from "../icons/LifeBuoy";
import { Flag } from "../icons/Flag";
import { EmitForfeitGameButton } from "../EmitForfaitGameButton/EmitForfaitGameButton";
import { RequestRematchButton } from "../RequestRematchButton/RequestRematchButton";
import { useMediaQuery } from "../../utils/screen/useMediaQuery";
import { classNames } from "../../utils/classNames";

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
  const isMobile = useMediaQuery("(max-width: 500px), (max-height: 500px)");
  return (
    <div className={styles.GameHeader}>
      {isMobile ? (
        <img
          alt="Pirates - BattleShips"
          src={"/assets/title-2-128.png"}
          className={classNames(
            styles.Header_title,
            styles.Header_mobile_title,
          )}
        />
      ) : (
        <img
          alt="Pirates - BattleShips"
          src="/assets/title-120.png"
          className={styles.Header_title}
        />
      )}
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
            result={gameState.result[gameState.self.id]}
          />
        )}
        {gameState && (
          <PlayerDetails
            className={styles.away}
            self={gameState.enemy}
            enemy
            phase={gameState.phase}
            result={gameState.result[gameState.enemy.id]}
          />
        )}
      </div>
    </div>
  );
};
