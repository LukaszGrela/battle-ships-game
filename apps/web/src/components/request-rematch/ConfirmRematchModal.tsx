import styles from "./ConfirmRematchModal.module.css";
import { TRematchRequest } from "@repo/types";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../Modal";
import { socket } from "../../socket";
import { Button } from "../Button";
import { Waves } from "../Waves";

const challengeMessages = [
  (name: string) => <>Pirate {name} challenges ye to another battle.</>,
  (name: string) => <>Arrr! {name} be callin' ye out for a second round!</>,
  (name: string) => <>Ahoy! {name} wants another go at yer fleet!</>,
  (name: string) => <>Cap'n {name} demands revenge on the high seas!</>,
  (name: string) => (
    <>{name} be sharpenin' the cannons and askin' fer a rematch!</>
  ),
];

const acceptQuestions = [
  "Do ye accept, or be ye a landlubber?",
  "Will ye take up the gauntlet?",
  "Do ye have the guts to face 'em again?",
  "What say ye — battle or retreat?",
  "Do ye dare to sail into battle once more?",
];

export const ConfirmRematchModal: FC<{
  open: boolean;
  request?: TRematchRequest;
}> = ({ open, request }) => {
  const [copyIndex, setCopyIndex] = useState(() => ({
    message: Math.floor(Math.random() * challengeMessages.length),
    question: Math.floor(Math.random() * acceptQuestions.length),
  }));
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCopyIndex({
        message: Math.floor(Math.random() * challengeMessages.length),
        question: Math.floor(Math.random() * acceptQuestions.length),
      });
    }

    wasOpen.current = open;
  }, [open]);

  const handleReject = () => {
    socket.emit("reject_rematch");
  };
  const handleAccept = () => {
    socket.emit("accept_rematch");
  };

  const modalFooterRenderer = useCallback(() => {
    return (
      <>
        <Button type="secondary" onClick={handleReject}>
          <span>Ney</span>
        </Button>
        <Button type="primary" onClick={handleAccept}>
          <span>Aye</span>
        </Button>
      </>
    );
  }, []);

  return (
    <Modal
      open={open}
      onClose={handleReject}

      title="Revenge request"
      footer={modalFooterRenderer}

      backdrop={false}
      keyboard={false}

      headerClassName={styles.title}
      bodyClassName={styles.Modal_body}

      // className={styles.Modal}
      // dialogClassName={styles.Modal_dialog}
    >
      <p className={styles.message1}>
        {challengeMessages[copyIndex.message]?.(request?.name ?? "Unknown") ??
          `Pirate ${request?.name} challenges ye to another battle.`}
      </p>
      <p className={styles.message2}>{acceptQuestions[copyIndex.question]}</p>
      <Waves className={styles.separator} />
    </Modal>
  );
};
