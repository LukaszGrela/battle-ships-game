import styles from "./GameWaiting.module.css";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { PlayerAvatar } from "../components/PirateAvatar/PirateAvatar";
import { Ribbon } from "../components/Ribbon/Ribbon";
import { useGameStore } from "../store/useGameStore";
import { WaitingScreen } from "../components/WaitingScreen/WaitingScreen";
import { classNames } from "../utils/classNames";
import { LifeBuoy } from "../components/icons/LifeBuoy";
import { EmitLeaveGameButton } from "../components/EmitLeaveGameButton/EmitLeaveGameButton";
import { Button } from "../components/Button";
import { BotIcon } from "../components/icons/BotIcon";
import { BotGameDifficultyModal } from "../components/BotGameDifficultyModal/BotGameDifficultyModal";
import { FC, useCallback, useState } from "react";
import { socket } from "../socket";
import { TRoomIdentity } from "@repo/types";
import { GrelaDesign } from "../components/GrelaDesign/GrelaDesign";

export const GameWaiting = () => {
  const { gameState } = useGameStore();
  return (
    <AppLayout className={styles.GameWaiting}>
      {gameState && (
        <>
          <div className={styles.GameWaiting_container}>
            <GameHeader />
            <WaitingScreen
              player={gameState.self}
              className={styles.GameWaiting_message}
            />
          </div>
          <EmitLeaveGameButton type="danger" className={styles.abandonGame}>
            <LifeBuoy />
            <span>Abandon game</span>
          </EmitLeaveGameButton>
          <AskBotGame id={gameState.id} name={gameState.name} />
          <GrelaDesign className={styles.footerLogo} />
        </>
      )}
    </AppLayout>
  );
};

const GameHeader = () => {
  const { gameState, selfId } = useGameStore();

  return (
    <>
      {selfId && (
        <div className={styles.GameWaiting_header}>
          <PlayerAvatar
            player={gameState!.self}
            className={styles.GameWaiting_avatar}
          />
          <Ribbon
            className={classNames(
              styles.GameWaiting_avatarName,
              gameState?.self.owner && styles.owner,
            )}
          >
            {gameState?.self.name}
          </Ribbon>
          <span className={styles.GameWaiting_warRoomName}>
            The {gameState?.name} war room.
          </span>
        </div>
      )}
    </>
  );
};

const AskBotGame: FC<Pick<TRoomIdentity, "id" | "name">> = ({ id, name }) => {
  const [open, setOpen] = useState(false);

  const createBotGameHandler = useCallback(() => {
    setOpen(true);
  }, []);

  const emitBotGame = useCallback(
    (difficulty: "easy" | "medium" | "hard") => {
      setOpen(false);
      // if (gameName) socket.emit("create_game_with_bot", gameName);
      if (id) {
        socket.emit(
          "bot_opponent",
          { roomIdentifier: { id, name }, difficulty },
          (result) => {
            console.warn("TODO: Handle response", result);
          },
        );
      }
    },
    [id, name],
  );

  return (
    <>
      <Button
        onClick={createBotGameHandler}
        className={styles.askBot}
        type="secondary"
      >
        <BotIcon />
        <span>Ask Bot</span>
      </Button>
      <BotGameDifficultyModal
        open={open}
        handleClose={() => {
          setOpen(false);
        }}
        setDifficulty={emitBotGame}
      />
    </>
  );
};
