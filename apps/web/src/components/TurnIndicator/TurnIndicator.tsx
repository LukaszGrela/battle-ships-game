import { FC, ReactNode } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import styles from "./TurnIndicator.module.css";
import { classNames } from "../../utils/classNames";

export const TurnIndicator: FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={classNames(styles.TurnIndicator_container, className)}>
      <Ribbon
        className={styles.TurnIndicator}
        ribbonFoldLeftChildren={<span className={styles.decoration}>⚔️</span>}
        ribbonFoldRightChildren={<span className={styles.decoration}>⚔️</span>}
      >
        <span className={"TurnIndicator_label"}>{children}</span>
      </Ribbon>
    </div>
  );
};
