import { classNames } from "../../utils/classNames";
import styles from "./Ribbon.module.css";
import { FC, ReactNode } from "react";

interface IProps {
  children: ReactNode;
  ribbonFoldLeftChildren?: ReactNode;
  ribbonFoldRightChildren?: ReactNode;
  className?: string;
}

export const Ribbon: FC<IProps> = ({
  children,
  className,
  ribbonFoldRightChildren,
  ribbonFoldLeftChildren,
}) => {
  return (
    <div className={classNames(styles.Ribbon, className)}>
      <div className={styles.ribbon}>
        {children}
        <div
          className={classNames(
            styles["ribbon-fold"],
            !!ribbonFoldLeftChildren && styles["ribbon-fold-children"],
            !!ribbonFoldLeftChildren && styles["ribbon-fold-children-left"],
            styles["ribbon-fold-left"],
          )}
        >
          {ribbonFoldLeftChildren}
        </div>
        <div
          className={classNames(
            styles["ribbon-fold"],
            !!ribbonFoldRightChildren && styles["ribbon-fold-children"],
            !!ribbonFoldRightChildren && styles["ribbon-fold-children-right"],
            styles["ribbon-fold-right"],
          )}
        >
          {ribbonFoldRightChildren}
        </div>
      </div>
    </div>
  );
};
