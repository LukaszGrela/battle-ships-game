import styles from "./Lobby.module.css";
import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { DisconnectButton } from "../components/DisconnectButton/DisconnectButton";
import { OpenGames } from "../components/OpenGames/OpenGames";
import { CreateNewGame } from "../components/CreateNewGame/CreateNewGame";
import { StatsContainer } from "../components/StatsContainer/StatsContainer";
import { useSocketGameStats } from "../store/useGameStatsStore";

export const Lobby: FC = () => {
  return (
    <AppLayout header={<Header />} headerClassName={styles.Lobby_header}>
      <ConnectedLobby />
    </AppLayout>
  );
};

const Header = () => {
  return (
    <>
      <img
        alt="Pirates - BattleShips"
        src="./title.png"
        className={styles.Header_title}
      />
      <DisconnectButton className={styles.Header_disconnect} />
    </>
  );
};

const ConnectedLobby = () => {
  useSocketGameStats();

  return (
    <section className={styles.Lobby_content}>
      <CreateNewGame className={styles.column1} />
      <OpenGames className={styles.column2} />
      <StatsContainer className={styles.stats} />
    </section>
  );
};
