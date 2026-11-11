import styles from "./Lobby.module.css";
import { FC } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { DisconnectButton } from "../components/DisconnectButton/DisconnectButton";
import { OpenGames } from "../components/OpenGames/OpenGames";
import { CreateNewGame } from "../components/CreateNewGame/CreateNewGame";
import { StatsContainer } from "../components/StatsContainer/StatsContainer";
import { useConnectionStatus } from "../store/useConnectionStatus";
import { PlayerAvatar } from "../components/PirateAvatar/PirateAvatar";
import { Ribbon } from "../components/Ribbon/Ribbon";

export const Lobby: FC = () => {
  return (
    <AppLayout header={<Header />} headerClassName={styles.Lobby_header}>
      <ConnectedLobby />
    </AppLayout>
  );
};

const Header = () => {
  const { clientSession } = useConnectionStatus();
  return (
    <>
      <DisconnectButton className={styles.Header_disconnect} />
      <img
        alt="Pirates - BattleShips"
        src="/assets/title.png"
        className={styles.Header_title}
      />

      {clientSession && (
        <div className={styles.self}>
          <div className={styles.Avatar}>
            <PlayerAvatar player={clientSession} />
          </div>
          <Ribbon className={styles.Ribbon}>
            <span>{clientSession.name}</span>
          </Ribbon>
        </div>
      )}
    </>
  );
};

const ConnectedLobby = () => {
  return (
    <section className={styles.Lobby_content}>
      <CreateNewGame className={styles.column1} />
      <OpenGames className={styles.column2} />
      <StatsContainer className={styles.stats} />
    </section>
  );
};
