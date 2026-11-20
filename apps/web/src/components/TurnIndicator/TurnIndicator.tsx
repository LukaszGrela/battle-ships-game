import { FC, ReactNode } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import styles from "./TurnIndicator.module.css";
import { classNames } from "../../utils/classNames";
import { getSpriteStyle } from "../../assets/getSpriteStyle";
import { DECOR_SPRITES } from "../../assets/decorations";

export const TurnIndicator: FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const sprite = DECOR_SPRITES["crossedSabres"];

  return (
    <div className={classNames(styles.TurnIndicator_container, className)}>
      <Ribbon
        className={styles.TurnIndicator}
        ribbonFoldLeftChildren={
          <div
            className={styles.decoration}
            aria-hidden={true}
            style={getSpriteStyle(sprite, 24)}
          />
        }
        ribbonFoldRightChildren={
          <div
            className={styles.decoration}
            aria-hidden={true}
            style={getSpriteStyle(sprite, 24)}
          />
        }
      >
        <span className="TurnIndicator_label" aria-live="polite">
          {children}
        </span>
      </Ribbon>
    </div>
  );
};
