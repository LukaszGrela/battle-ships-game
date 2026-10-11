import styles from "./RematchRequestSentModal.module.css";

import { FC, useEffect, useRef, useState } from "react";
import { Modal } from "../Modal";
import { DotLoader } from "../DotLoader";
import { Waves } from "../Waves";

const messages = [
  "Revenge request sent!",
  "Rematch requested—ready for round two?",
  "Challenge sent. The rivalry continues!",
  "Your rival has been summoned for another bout.",
  "Revenge awaits!",
];

const loaderLabels = [
  "Waiting for a response",
  "Watching the horizon",
  "Waiting for your rival",
  "Keeping the cannons warm",
  "Awaiting their answer",
];

const randomItem = (items: readonly string[]) =>
  items[Math.floor(Math.random() * items.length)];

export const RematchRequestSentModal: FC<{ open?: boolean }> = ({
  open = false,
}) => {
  const [copy, setCopy] = useState(() => ({
    message: randomItem(messages),
    label: randomItem(loaderLabels),
  }));
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCopy({
        message: randomItem(messages),
        label: randomItem(loaderLabels),
      });
    }

    wasOpen.current = open;
  }, [open]);

  return (
    <Modal
      open={open}
      hideHeader
      headerClassName={styles.title}
      bodyClassName={styles.Modal_body}
    >
      <p className={styles.message}>{copy.message}</p>
      <Waves className={styles.separator} />
      <DotLoader label={copy.label} />
    </Modal>
  );
};
