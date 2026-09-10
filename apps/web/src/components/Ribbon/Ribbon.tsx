import { classNames } from "../../utils/classNames";
import styles from "./Ribbon.module.css";
import { FC, ReactNode } from "react";

interface IProps {
  children: ReactNode;
  className?: string;
}

export const Ribbon: FC<IProps> = ({ children, className }) => {
  return (
    <div className={classNames(styles.Ribbon, className)}>
      <div className={styles.ribbon}>
        {children}
        <div
          className={classNames(
            styles["ribbon-fold"],
            styles["ribbon-fold-left"],
          )}
        ></div>
        <div
          className={classNames(
            styles["ribbon-fold"],
            styles["ribbon-fold-right"],
          )}
        ></div>
      </div>
    </div>
  );
};
