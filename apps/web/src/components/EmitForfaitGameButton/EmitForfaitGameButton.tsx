import styles from "./EmitForfeitGameButton.module.css";
import { FC, useCallback, useState } from "react";
import { socket } from "../../socket";
import { useGameStore } from "../../store/useGameStore";
import { Button } from "../Button/Button";
import { TButtonProps } from "../Button/types";
import { Modal } from "../Modal/Modal";
import { Flag } from "../icons/Flag";
import { Swords } from "../icons/Swords";

export const EmitForfeitGameButton: FC<
  Omit<TButtonProps, "disabled" | "onClick">
> = ({ children = "Forfeit", className, size, type }) => {
  const { selfId, setGameState, setSelfId, setError } = useGameStore();

  const [open, setOpen] = useState(false);

  const askQuestion = () => {
    setOpen(true);
  };

  const modalFooterRenderer = useCallback(
    (_: boolean, onClose: () => void) => {
      const confirm = () => {
        onClose();

        setGameState(null);
        setSelfId(null);
        setError(null);

        socket.emit("leave_game");
      };
      return (
        <>
          <Button type="secondary" onClick={onClose}>
            <Swords />
            <span>Nigdy!</span>
          </Button>
          <Button type="danger" onClick={confirm}>
            <span>Oui</span> <Flag />
          </Button>
        </>
      );
    },
    [setError, setGameState, setSelfId],
  );

  return (
    <>
      <Button
        className={className}
        onClick={askQuestion}
        disabled={!!selfId === false}
        type={type}
        size={size}
      >
        {children}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}

        title="Forfeit"
        footer={modalFooterRenderer}

        backdrop={false}
        keyboard={false}

        className={styles.Modal}
        bodyClassName={styles.Modal_body}
        dialogClassName={styles.Modal_dialog}
      >
        <p>Are you sure you want to surrender?</p>
      </Modal>
    </>
  );
};
