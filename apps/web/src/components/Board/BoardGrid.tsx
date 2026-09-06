import { FC, useCallback } from "react";
import { classNames } from "../../utils/classNames";
import styles from "./BoardGrid.module.css";
import { TCell, TInteractivityProps, TProps } from "./types";

export const BoardGrid: FC<TProps> = ({
  board,
  className,
  heading,
  ...interactiveProps
}) => {
  console.log("BoardGrid", board);
  return (
    <div className={classNames(styles.BoardGrid, className)}>
      {heading && <h2>{heading}</h2>}
      <div className={styles.BoardGrid_layout}>
        <div className={styles.BoardGrid_columns}>
          <ColumnLabels size={board.length} />
        </div>
        <div className={styles.BoardGrid_rows}>
          <RowLabels size={board.at(0)?.length ?? 0} />
        </div>
        <div className={styles.BoardGrid_grid}>
          <Grid board={board} {...interactiveProps} />
        </div>
      </div>
    </div>
  );
};

const ColumnLabels: FC<{ size: number }> = ({ size }) => {
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
const RowLabels: FC<{ size: number }> = ({ size }) => {
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

const Grid: FC<Pick<TProps, "board"> & TInteractivityProps> = ({
  board,
  ...interactiveProps
}) => {
  return (
    <div className={styles.Grid}>
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

const Cell: FC<TCell> = ({ status, coords, disabled, ...interactiveProps }) => {
  const Tag = interactiveProps.isInteractive ? "button" : "div";
  const handleClick = useCallback(() => {
    if (interactiveProps.isInteractive) interactiveProps.onClick(coords);
  }, [coords, interactiveProps]);
  return (
    <Tag
      aria-label={`Cell ${coords.x},${coords.y} - ${status}`}

      className={styles.Cell}
      data-disabled={disabled ? "" : undefined}
      data-interactive={interactiveProps.isInteractive ? "" : undefined}
      onClick={interactiveProps.isInteractive ? handleClick : undefined}
    >
      {status.charAt(0)}
    </Tag>
  );
};
