import styles from "./BoardGrid.module.css";
import { FC } from "react";
import { TInteractivityProps, TProps } from "./types";
import { Cell } from "./Cell";
export const Grid: FC<
  Pick<TProps, "board" | "disabled"> & TInteractivityProps
> = ({ board, ...interactiveProps }) => {
  const inert = interactiveProps.disabled;
  return (
    <div className={styles.Grid} inert={inert}>
      {board.flatMap((rowData, row) => {
        return rowData.map((cellData, column) => (
          <Cell
            key={`${column}:${row}`}
            status={cellData}
            coords={{ x: column, y: row }}
            {...interactiveProps}
          />
        ));
      })}
    </div>
  );
};
