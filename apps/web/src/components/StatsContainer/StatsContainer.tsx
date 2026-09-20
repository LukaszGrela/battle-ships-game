import styles from "./StatsContainer.module.css";
import { FC } from "react";
import { DecoratedContainer } from "../DecoratedContainer";
import { classNames } from "../../utils/classNames";
import { useGameStatsStore } from "../../store/useGameStatsStore";

export const StatsContainer: FC<{
  className?: string;
}> = ({ className }) => {
  const { activeGames, activePlayers, playedGames } = useGameStatsStore();
  return (
    <DecoratedContainer
      className={classNames(styles.StatsContainer, className)}
      header={<span className={styles.shadow}>Server stats</span>}
    >
      <span>Active games: {activeGames}</span>
      <span>Active players: {activePlayers}</span>
      <span>Played games: {playedGames}</span>
    </DecoratedContainer>
  );
};
