import styles from "./BoardGrid.module.css";
import { FC } from "react";

export const ColumnLabels: FC<{ size: number }> = ({ size }) => {
  return (
    <>
      {Array.from(Array(size)).map((_, index) => {
        const label = String.fromCharCode(65 + index);
        return (
          <span key={`${label}`} className={styles.ColumnLabels_label}>
            {label}
          </span>
        );
      })}
    </>
  );
};
