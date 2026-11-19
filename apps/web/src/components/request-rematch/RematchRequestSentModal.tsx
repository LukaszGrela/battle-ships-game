import styles from "./RematchRequestSentModal.module.css";

import { FC, useEffect, useRef, useState } from "react";
import { TRematchRequest } from "@repo/types";
import { Modal } from "../Modal";
import { DotLoader } from "../DotLoader";
import { Waves } from "../Waves";
import { Button } from "../Button";
import { socket } from "../../socket";

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

const getRemainingSeconds = (expiresAt?: string) => {
  if (!expiresAt) return null;

  const remaining = Date.parse(expiresAt) - Date.now();
  if (Number.isNaN(remaining)) return null;

  return Math.max(0, Math.ceil(remaining / 1000));
};

export const RematchRequestSentModal: FC<{
  open?: boolean;
  request?: TRematchRequest;
}> = ({ open = false, request }) => {
  const [copy, setCopy] = useState(() => ({
    message: randomItem(messages),
    label: randomItem(loaderLabels),
  }));
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(request?.expiresAt),
  );
  const [cancelling, setCancelling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wasOpen = useRef(open);

  const status = request?.status;
  const isCancelled = status === "cancelled";

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCopy({
        message: randomItem(messages),
        label: randomItem(loaderLabels),
      });
    }

    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (status !== "pending") {
      setCancelling(false);
      return;
    }

    setRemainingSeconds(getRemainingSeconds(request?.expiresAt));

    const interval = setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(request?.expiresAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [status, request?.expiresAt]);

  useEffect(() => {
    if (status === "pending") setDismissed(false);
  }, [status]);

  const handleCancel = () => {
    if (cancelling) return;

    setCancelling(true);
    socket.emit("cancel_rematch");
  };

  if (dismissed) return null;

  return (
    <Modal
      open={open}
      hideHeader
      headerClassName={styles.title}
      bodyClassName={styles.Modal_body}
      className={styles.Modal}
      dialogClassName={styles.Modal_dialog}
      onClose={isCancelled ? () => setDismissed(true) : undefined}
      backdrop={isCancelled}
      keyboard={isCancelled}
      footer={
        isCancelled
          ? (_open, onClose) => (
              <Button type="primary" onClick={onClose}>
                Close
              </Button>
            )
          : undefined
      }
    >
      {isCancelled ? (
        <>
          <p className={styles.message}>
            {request?.cancelledReason === "timeout"
              ? "The rematch request timed out and was cancelled."
              : "You cancelled the rematch request."}
          </p>
          <Waves className={styles.separator} />
          <p className={styles.notice}>
            You cannot send another rematch request for this game.
          </p>
        </>
      ) : (
        <>
          <p className={styles.message}>{copy.message}</p>
          <Waves className={styles.separator} />
          <DotLoader label={copy.label} />
          {remainingSeconds !== null && (
            <p className={styles.timer}>
              Request expires in {remainingSeconds}s
            </p>
          )}
          <div className={styles.actions}>
            <Button
              type="secondary"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel request"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};
