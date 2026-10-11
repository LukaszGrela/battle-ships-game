import styles from "./StatsContainer.module.css";
import { FC } from "react";
import { DecoratedContainer } from "../DecoratedContainer";
import { classNames } from "../../utils/classNames";
import { useGameStatsStore, useSocketGameStats } from "../../store/useGameStatsStore";

export const StatsContainer: FC<{
  className?: string;
}> = ({ className }) => {
  useSocketGameStats();

  const { activeGames, activePlayers, playedGames } = useGameStatsStore();
  return (
    <DecoratedContainer
      className={classNames(styles.StatsContainer, className)}
      header={<span className={"shadow"}>Server stats</span>}
    >
      <span>Active games: {activeGames}</span>
      <span>Active players: {activePlayers}</span>
      <span>Played games: {playedGames}</span>
    </DecoratedContainer>
  );
};
