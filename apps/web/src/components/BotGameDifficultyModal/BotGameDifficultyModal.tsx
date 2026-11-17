import styles from "./BotGameDifficultyModal.module.css";
import { FC } from "react";
import { Button } from "../Button";
import { BotIcon } from "../icons/BotIcon";
import { Modal } from "../Modal";
import { TBotDifficulty } from "@repo/types";

export const BotGameDifficultyModal: FC<{
  open: boolean;
  handleClose: () => void;
  setDifficulty: (difficulty: TBotDifficulty) => void;
}> = ({ open, handleClose, setDifficulty }) => {
  return (
    <Modal
      className={styles.BotGameDifficultyModal}
      dialogClassName={styles.BotGameDifficultyModal_dialog}
      bodyClassName={styles.BotGameDifficultyModal_body}
      open={open}
      onClose={handleClose}
      icon={<BotIcon />}
      title={"Bot Game Difficulty"}
    >
      <h3>Choose level</h3>
      <div className={styles.BotGameDifficultyModal_list}>
        <Button
          type="info"
          onClick={() => {
            setDifficulty("easy");
          }}
        >
          Easy
        </Button>
        <Button
          type="secondary"
          onClick={() => {
            setDifficulty("medium");
          }}
        >
          Medium
        </Button>
        <Button
          type="danger"
          onClick={() => {
            setDifficulty("hard");
          }}
        >
          Hard
        </Button>
      </div>
    </Modal>
  );
};
