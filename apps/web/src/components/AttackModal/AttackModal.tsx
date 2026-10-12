import styles from "./AttackModal.module.css";

import { CSSProperties, FC, useMemo } from "react";
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

const Title: FC<{ result: null | ECellStatus; className?: string }> = ({
  result,
  className,
}) => {
  const title = useMemo(() => {
    if (!result) return "Waiting for attack result";
    if (result === ECellStatus.Destroyed) return "Ship was destroyed";

    return result;
  }, [result]);

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
}> = ({ open, onClose, result }) => {
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
      // className={styles.backdrop}
      // dialogClassName={classNames(styles.panel, className)}
      // bodyClassName={styles.panel_body}
      aria-labelledby="attack-modal-title"
      hideHeader
    >
      <Title result={result} className={styles.AttackModule_title} />

      <div className={styles.AttackModule_body}>
        <div
          // className={styles.decor}
          aria-hidden={true}
          style={getSpriteStyle(sprite, 128)}
        />
        {result != null && resultSprite && (
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
      </div>

      {result !== null && (
        <Waves
          className={styles.AttackModule_timeout}
          timeout
          style={{ "--wave-timout-duration": "5s" } as CSSProperties}
          onDrained={onClose}
        />
      )}
    </Modal>
  );
};
