import styles from "./BoardGrid.module.css";
import { FC, ReactNode } from "react";
import { TProps } from "./types";
import { ColumnLabels } from "./ColumnLabels";
import { RowLabels } from "./RowLabels";
import { classNames } from "../../utils/classNames";

export const BoardGridContainer: FC<
  Pick<TProps, "className" | "heading"> & {
    children: ReactNode;
    rows: number;
    columns: number;
    gridSlotClassName?: string;
  }
> = ({
  className,
  heading,
  children: grid,
  rows,
  columns,
  gridSlotClassName,
}) => {
  return (
    <div className={classNames(className)}>
      {heading && <h2>{heading}</h2>}
      <div className={styles.BoardGrid_container}>
        <div className={styles.BoardGrid_layout}>
          <div className={styles.BoardGrid_columns}>
            <ColumnLabels size={columns} />
          </div>
          <div className={styles.BoardGrid_rows}>
            <RowLabels size={rows} />
          </div>
          <div className={classNames(styles.BoardGrid_grid, gridSlotClassName)}>
            {grid}
          </div>
        </div>
      </div>
    </div>
  );
};
