import styles from "./BoardGrid.module.css";
import { CSSProperties, FC, ReactNode } from "react";
import { TProps } from "./types";
import { ColumnLabels } from "./ColumnLabels";
import { RowLabels } from "./RowLabels";
import { classNames } from "../../utils/classNames";

export const BoardGridContainer: FC<
  Pick<TProps, "className" | "pad"> & {
    children: ReactNode;
    rows: number;
    columns: number;
    gridSlotClassName?: string;

    hideColumnLabels?: boolean;
    hideRowLabels?: boolean;
  }
> = ({
  className,
  children: grid,
  rows,
  columns,
  gridSlotClassName,
  hideColumnLabels,
  hideRowLabels,
  pad = 1,
}) => {
  return (
    <div
      className={classNames(className)}
      style={
        {
          "--grid-pad": pad,
        } as CSSProperties
      }
    >
      <div className={classNames("container", styles.BoardGrid_container)}>
        <div className={styles.BoardGrid_layout}>
          <div className={styles.BoardGrid_columns}>
            {!hideColumnLabels && <ColumnLabels size={columns} pad={pad} />}
          </div>
          <div className={styles.BoardGrid_rows}>
            {!hideRowLabels && <RowLabels size={rows} pad={pad} />}
          </div>
          <div className={classNames(styles.BoardGrid_grid, gridSlotClassName)}>
            {grid}
          </div>
        </div>
      </div>
    </div>
  );
};
