import { useEffect, useState } from "react";
import styles from "./OpponentTurnModal.module.css";
import { TProps as TModalProps } from "../Modal/types";
import { Modal } from "../Modal/Modal";
import { IPlayer } from "@repo/types";
import { classNames } from "../../utils/classNames";
import { DotLoader } from "../DotLoader";
import { Waves } from "../Waves";

const OPPONENT_TURN_MESSAGES = [
  "The foe consults their charts",
  "Plotting afoot on the enemy deck",
  "Awaiting the scallywag's move",
  "Watching the enemy's sails",
  "The foe sharpens their cutlass",
  "A tense calm upon the water",
  "Your rival counts their cannon balls",
  "The enemy ponders their strike",
  "Steady, matey — let them think",
  "The foe contrives their mischief",
  "Their move is in the making",
] as const;

const getOpponentTitleMessage = (opponentName: string) => {
  const list = [
    `${opponentName} charts a wicked course`,
    `${opponentName} weighs their options`,
    `${opponentName} studies the battle lines`,
    `${opponentName} calculates the odds`,
    `${opponentName} bares their teeth`,
    `${opponentName} prepares a broadside`,
    `${opponentName} sharpens their blades`,
    `${opponentName} smells blood in the water`,
    `${opponentName} adjusts the rigging`,
    `${opponentName} takes the wheel`,
    `${opponentName} steers into the wind`,
    `${opponentName} hoists false colors`,

    "The enemy makes their move",
    "A rival approaches",
    "The tide shifts",
    "Incoming fire",
  ];
  const index = Math.floor(Math.random() * list.length);

  return list[index];
};

type TProps = {
  /** Rotate to a new message every N ms. Omit or pass 0 to lock one message. */
  rotateMs?: number;

  player: IPlayer;
} & Pick<TModalProps, "className" | "open" | "onClose">;

export function OpponentTurnModal({
  rotateMs = 0,
  player,
  onClose,
  open,
  className,
}: TProps) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * OPPONENT_TURN_MESSAGES.length),
  );

  useEffect(() => {
    if (!rotateMs) return;

    const id = setInterval(() => {
      setIndex((prev) => {
        // Advance by 1–3 so the sequence never feels mechanical
        const step = 1 + Math.floor(Math.random() * 3);
        return (prev + step) % OPPONENT_TURN_MESSAGES.length;
      });
    }, rotateMs);

    return () => clearInterval(id);
  }, [rotateMs]);

  const message = OPPONENT_TURN_MESSAGES[index];

  return (
    <Modal
      backdrop={false}
      keyboard={false}
      open={open}
      onClose={onClose}
      className={styles.backdrop}
      dialogClassName={classNames(styles.panel, className)}
      bodyClassName={styles.panel_body}
      aria-labelledby="opponent-turn-title"
      hideHeader
    >
      <div className={styles.icon} aria-hidden="true">
        ⚔️
      </div>

      <h2 id="opponent-turn-title" className={styles.title}>
        {getOpponentTitleMessage(player.name)}
      </h2>

      <p className={styles.message} aria-live="polite">
        {message}
      </p>

      <Waves className={styles.waves} />

      <DotLoader className={styles.loader} label={"Waiting on the enemy"} />
    </Modal>
  );
}
