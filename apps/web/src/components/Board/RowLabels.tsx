import styles from "./BoardGrid.module.css";
import { FC } from "react";

export const RowLabels: FC<{ size: number }> = ({ size }) => {
  return (
    <>
      {Array.from(Array(size)).map((_, index) => {
        const label = `${index + 1}`;
        return (
          <span key={`${label}`} className={styles.RowLabels_label}>
            {label}
          </span>
        );
      })}
    </>
  );
};
