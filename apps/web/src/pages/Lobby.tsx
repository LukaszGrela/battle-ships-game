import styles from "./Lobby.module.css";
import { FC, useMemo } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { DisconnectButton } from "../components/DisconnectButton/DisconnectButton";
import { OpenGames } from "../components/OpenGames/OpenGames";
import { CreateNewGame } from "../components/CreateNewGame/CreateNewGame";
import { StatsContainer } from "../components/StatsContainer/StatsContainer";
import { useConnectionStatus } from "../store/useConnectionStatus";
import { PlayerAvatar } from "../components/PirateAvatar/PirateAvatar";
import { Ribbon } from "../components/Ribbon/Ribbon";
import { useMediaQuery } from "../utils/screen/useMediaQuery";
import { classNames } from "../utils/classNames";
import { seedRandom } from "@repo/game-logic";

const GREETINGS = [
  "Ahoy,",
  "Yo-ho-ho,",
  "Avast,",
  "Ahoy there,",
  "Hoist up,",
  "Arr,",
  "Well met,",
  "Godspeed ye,",
  "Come one, come all,",
];

export const Lobby: FC = () => {
  const isMobile = useMediaQuery("(max-width: 500px), (max-height: 500px)");
  console.log("[Lobby] isMobile", isMobile);

  return (
    <AppLayout
      header={isMobile ? <MobileHeader /> : <Header />}
      headerClassName={classNames(styles.Lobby_header)}
    >
      <ConnectedLobby />
    </AppLayout>
  );
};

const MobileHeader = () => {
  const { clientSession } = useConnectionStatus();

  const random = useMemo(
    () => clientSession && seedRandom(clientSession.seed),
    [clientSession],
  );

  const greetings = useMemo(() => {
    return random && GREETINGS[random.nextInt(0, GREETINGS.length - 1)];
  }, [random]);

  return (
    <>
      <div className={classNames(styles.Header_mobile_toolbar)}>
        <DisconnectButton className={styles.Header_disconnect} />
        <img
          alt="Pirates - BattleShips"
          src={"/assets/title-2-128.png"}
          className={styles.Header_mobile_title}
        />
      </div>

      {clientSession && (
        <div className={styles.self}>
          <Ribbon
            className={styles.Ribbon}
            ribbonFoldRightClassName={styles.Avatar_holder}
            ribbonFoldRightChildren={
              <div className={styles.Avatar}>
                <PlayerAvatar player={clientSession} />
              </div>
            }
          >
            <div className={styles.Greetings}>
              <span className={styles.Greetings_greet}>{greetings}</span>
              <span className={styles.Greetings_name}>
                {clientSession.name}
              </span>
            </div>
          </Ribbon>
        </div>
      )}
    </>
  );
};

const Header = () => {
  const { clientSession } = useConnectionStatus();
  const random = useMemo(
    () => clientSession && seedRandom(clientSession.seed),
    [clientSession],
  );

  const greetings = useMemo(() => {
    return random && GREETINGS[random.nextInt(0, GREETINGS.length - 1)];
  }, [random]);
  return (
    <>
      <DisconnectButton className={styles.Header_disconnect} />

      <img
        alt="Pirates - BattleShips"
        src={"/assets/title-120.png"}
        className={styles.Header_title}
      />

      {clientSession && (
        <div className={styles.self}>
          <div className={styles.Avatar}>
            <PlayerAvatar player={clientSession} />
          </div>
          <Ribbon className={styles.Ribbon}>
            <div className={styles.Greetings}>
              <span className={styles.Greetings_greet}>{greetings}</span>
              <span className={styles.Greetings_name}>
                {clientSession.name}
              </span>
            </div>
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
