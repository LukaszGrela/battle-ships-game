import styles from "./AttackModal.module.css";

import { FC, useMemo } from "react";
import { Modal } from "../Modal";
import { ECellStatus } from "@repo/types";
import { Waves } from "../Waves";
import { getSpriteStyle } from "../../assets/getSpriteStyle";
import { DECOR_SPRITES } from "../../assets/decorations";
import { EXPLOSION_ATLAS, EXPLOSION_SPRITES } from "../../assets/explosions";
import { SPLASH_ATLAS, SPLASH_SPRITES } from "../../assets/splashes";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** Piratey flavor lines per attack state, split by whether the
 * current player fired the shot (`attack`) or is receiving it. */
const MESSAGES = {
  waiting: {
    attack: ["Cannonball in flight…", "Steady now, the shot sails on…"],
    defend: ["Brace for impact!", "Enemy broadside incomin'!"],
  },
  miss: {
    attack: [
      "Splash! Ye hit naught but brine.",
      "The sea be the only casualty today, arrr.",
    ],
    defend: [
      "Ha! Their aim be rotten as bilge water.",
      "They hit naught but the sea!",
    ],
  },
  hit: {
    attack: [
      "Direct hit! Their timbers be shiverin'!",
      "Boom! Right between their planks!",
    ],
    defend: ["We're hit! Man the pumps!", "Blast! They've holed our hull!"],
  },
  destroyed: {
    attack: [
      "Ye sent 'em to Davy Jones' Locker!",
      "Down to the depths with that scurvy dog!",
    ],
    defend: [
      "Abandon ship! She's bound for Davy Jones' Locker…",
      "Our ship… she be lost to the deep.",
    ],
  },
} as const;

const Title: FC<{
  result: null | ECellStatus;
  className?: string;
  attack: boolean;
}> = ({ result, className, attack }) => {
  const title = useMemo(() => {
    const side = attack ? "attack" : "defend";
    switch (result) {
      case ECellStatus.Miss:
        return pick(MESSAGES.miss[side]);
      case ECellStatus.Destroyed:
        return pick(MESSAGES.destroyed[side]);
      case null:
        return pick(MESSAGES.waiting[side]);
      default:
        return pick(MESSAGES.hit[side]);
    }
  }, [result, attack]);

  return (
    <h2 id="attack-modal-title" className={className}>
      {title}
    </h2>
  );
};

export const AttackModal: FC<{
  /**
   * When `true` this modal shows results
   * of current player attack, otherwise
   * it shows result of enemy attack.
   */
  attack: boolean;
  open: boolean;
  onClose: () => void;
  result: ECellStatus | null;
  shipSize: number;
}> = ({ open, onClose, result, shipSize, attack }) => {
  const sprite = DECOR_SPRITES["cannon"];
  const resultSprite = useMemo(
    () =>
      !result || result === ECellStatus.Miss
        ? SPLASH_ATLAS[pick(SPLASH_SPRITES)]
        : EXPLOSION_ATLAS[pick(EXPLOSION_SPRITES)],
    [result],
  );
  return (
    <Modal
      backdrop={false}
      keyboard={false}
      open={open}
      onClose={onClose}
      className={styles.backdrop}
      dialogClassName={styles.panel}
      bodyClassName={styles.panel_body}
      aria-labelledby="attack-modal-title"
      hideHeader
    >
      <Title result={result} className={styles.title} attack={attack} />

      <div className={styles.body}>
        {result !== ECellStatus.Destroyed && (
          <div
            // className={styles.decor}
            aria-hidden={true}
            style={getSpriteStyle(sprite, 128)}
          />
        )}

        {result != null && result !== ECellStatus.Destroyed && resultSprite && (
          <div
            aria-hidden={true}
            style={getSpriteStyle(
              resultSprite,
              64,
              result === ECellStatus.Miss
                ? 'url("/assets/splashes-sprites.png")'
                : 'url("/assets/explosions-sprites.png")',
              64,
              256,
              256,
            )}
          />
        )}

        {result === ECellStatus.Destroyed && (
          <DestroyedShipImage size={shipSize} />
        )}
      </div>

      {result !== null && (
        <Waves
          className={styles.timeout}
          timeout
          onDrained={onClose}
        />
      )}
    </Modal>
  );
};

const DestroyedShipImage: FC<{ size: number }> = ({ size = 2 }) => {
  return (
    <img
      src={`/ships/size-${size}-destroyed-side-view.png`}
      width={256}
      height={256}
      aria-hidden={true}
    />
  );
};
