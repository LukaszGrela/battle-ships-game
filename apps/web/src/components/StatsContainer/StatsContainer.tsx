import styles from "./StatsContainer.module.css";
import { FC } from "react";
import { DecoratedContainer } from "../DecoratedContainer";
import { classNames } from "../../utils/classNames";
import {
  useGameStatsStore,
  useSocketGameStats,
} from "../../store/useGameStatsStore";

export const StatsContainer: FC<{
  className?: string;
}> = ({ className }) => {
  useSocketGameStats();

  const { activeGames, activePlayers, playedGames } = useGameStatsStore();
  return (
    <DecoratedContainer
      className={classNames(styles.StatsContainer, className)}
      header={<span className={"shadow"}>Stats</span>}
    >
      <div className={styles.StatsContainer_content}>
        <div className={styles.StatsContainer_server}>
          <h4>Server</h4>
          <span>Active games: {activeGames}</span>
          <span>Active players: {activePlayers}</span>
          <span>Played games: {playedGames}</span>
        </div>
        <div className={styles.StatsContainer_user}>
          <h4>User</h4>
          <span>Games won: 0</span>
          <span>Games lost: 0</span>
        </div>
      </div>
    </DecoratedContainer>
  );
};
