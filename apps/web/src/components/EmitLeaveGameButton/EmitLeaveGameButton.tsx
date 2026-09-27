import styles from "./EmitLeaveGameButton.module.css";
import { useCallback, useState, type FC } from "react";
import { useGameStore } from "../../store/useGameStore";
import { socket } from "../../socket";
import { Button } from "../Button/Button";
import { TButtonProps } from "../Button/types";
import { Modal } from "../Modal";

export const EmitLeaveGameButton: FC<
  Omit<TButtonProps, "onClick"> & {
    skipConfirmation?: boolean;
  }
> = ({
  children = "Leave Game",
  type,
  className,
  size,
  skipConfirmation = false,
  ...rest
}) => {
  const [open, setOpen] = useState(false);

  const { selfId, gameState, setGameState, setSelfId, setError } =
    useGameStore();
  const gameFinished = gameState?.phase === "finished";
  console.log("[EmitLeaveGameButton]", "Game finished", gameFinished);
  const leaveGame = useCallback(() => {
    if (gameFinished) {
      setGameState(null);
      setSelfId(null);
      setError(null);
    } else {
      socket.emit("leave_game");
    }
  }, [gameFinished, setError, setGameState, setSelfId]);

  const askQuestion = useCallback(() => {
    if (!skipConfirmation) {
      setOpen(true);
    } else {
      leaveGame();
    }
  }, [skipConfirmation, leaveGame]);

  const modalFooterRenderer = useCallback(
    (_: boolean, onClose: () => void) => {
      const confirm = () => {
        onClose();

        leaveGame();
      };
      return (
        <>
          <Button type="secondary" onClick={onClose}>
            <span>No</span>
          </Button>
          <Button type="danger" onClick={confirm}>
            <span>Yes</span>
          </Button>
        </>
      );
    },
    [leaveGame],
  );
  return (
    <>
      <Button
        className={className}
        onClick={askQuestion}
        disabled={!!selfId === false}
        type={type}
        size={size}
        {...rest}
      >
        {children}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}

        title="Abandon game"
        footer={modalFooterRenderer}

        backdrop={false}
        keyboard={false}

        className={styles.Modal}
        bodyClassName={styles.Modal_body}
        dialogClassName={styles.Modal_dialog}
      >
        <p>Are you sure you want to leave game?</p>
      </Modal>
    </>
  );
};
