import styles from "./Lobby.module.css";
import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { DisconnetButton } from "../components/DisconnetButton/DisconnetButton";
import { OpenGames } from "../components/OpenGames/OpenGames";
import { CreateNewGame } from "../components/CreateNewGame/CreateNewGame";

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
      <DisconnetButton className={styles.Header_disconnect} />
    </>
  );
};

const ConnectedLobby = () => {
  return (
    <section className={styles.Lobby_content}>
      <CreateNewGame className={styles.column1} />
      <OpenGames className={styles.column2} />
    </section>
  );
};
