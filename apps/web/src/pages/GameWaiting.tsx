import styles from "./GameWaiting.module.css";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { PlayerAvatar } from "../components/PirateAvatar/PirateAvatar";
import { Ribbon } from "../components/Ribbon/Ribbon";
import { useGameStore } from "../store/useGameStore";
import { WaitingScreen } from "../components/WaitingScreen/WaitingScreen";

export const GameWaiting = () => {
  const { gameState } = useGameStore();
  return (
    <AppLayout className={styles.GameWaiting}>
      {gameState && (
        <div className={styles.GameWaiting_container}>
          <GameHeader />
          <WaitingScreen
            player={gameState.self}
            className={styles.GameWaiting_message}
          />
        </div>
      )}
    </AppLayout>
  );
};

export const GameHeader = () => {
  const { gameState, selfId } = useGameStore();

  return (
    <>
      {selfId && (
        <div className={styles.GameWaiting_header}>
          <PlayerAvatar
            player={gameState!.self}
            className={styles.GameWaiting_avatar}
          />
          <Ribbon className={styles.GameWaiting_avatarName}>
            {gameState?.self.name}
          </Ribbon>
        </div>
      )}
    </>
  );
};
