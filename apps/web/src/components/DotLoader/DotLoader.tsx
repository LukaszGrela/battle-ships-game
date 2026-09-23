import { classNames } from "../../utils/classNames";
import styles from "./DotLoader.module.css";
import { FC } from "react";

export const DotLoader: FC<{ label?: string; className?: string }> = ({
  label,
  className,
}) => {
  return (
    <div
      className={classNames(styles.DotLoader, className)}
      role="status"
      aria-live="polite"
    >
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.dots} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
};
