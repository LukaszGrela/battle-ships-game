import styles from "./BoardGrid.module.css";
import { FC } from "react";

export const ColumnLabels: FC<{ size: number; pad?: number }> = ({
  size,
  pad = 0,
}) => {
  return (
    <>
      {Array.from(Array(size + 2 * pad)).map((_, index, { length }) => {
        const label = getLabel(index, length, pad);
        return (
          <span
            key={`${index}-${label}`}
            className={styles.ColumnLabels_label}
            data-col={index}
          >
            {label}
          </span>
        );
      })}
    </>
  );
};

const getLabel = (index: number, length: number, pad: number) => {
  if (pad > 0 && (index < pad || index > length - 1 - pad)) return "";

  return String.fromCharCode(65 + index - pad);
};
