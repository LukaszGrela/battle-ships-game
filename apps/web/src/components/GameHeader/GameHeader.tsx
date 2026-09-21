import styles from "./GameHeader.module.css";
import { FC } from "react";
import { EGamePhase, TGameState } from "@repo/types";
import { PlayerDetails } from "../PlayerDetails/PlayerDetails";

export type TGameHeaderAllowedState = TGameState & {
  phase: EGamePhase.Placement | EGamePhase.Playing | EGamePhase.Finished;
};
export const GameHeader: FC<{
  gameState: TGameHeaderAllowedState;
}> = ({ gameState }) => {
  return (
    <div className={styles.GameHeader}>
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
  );
};
