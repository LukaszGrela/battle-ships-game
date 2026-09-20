import styles from "./DecoratedContainer.module.css";
import { FC, ReactNode } from "react";
import { classNames } from "../../utils/classNames";
import { Ribbon } from "../Ribbon/Ribbon";

export const DecoratedContainer: FC<{
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ className, children, header: heading }) => {
  return (
    <div className={classNames(styles.DecoratedContainer, className)}>
      {heading && (
        <h3>
          <Ribbon className={styles.DecoratedContainer_heading}>
            {heading}
          </Ribbon>
        </h3>
      )}
      <div className={styles.DecoratedContainer_container}>{children}</div>
    </div>
  );
};
