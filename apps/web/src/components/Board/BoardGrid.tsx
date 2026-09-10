import { FC, MouseEvent, ReactNode, useCallback } from "react";
import { classNames } from "../../utils/classNames";
import styles from "./BoardGrid.module.css";
import { TCell, TInteractivityProps, TProps } from "./types";
import { ECellStatus } from "@repo/types";

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
      <div className={styles.BoardGrid}>
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

export const BoardGrid: FC<TProps> = ({
  board,
  className,
  heading,
  ...interactiveProps
}) => {
  console.log("BoardGrid", board);
  console.log("BoardGrid.interactiveProps", interactiveProps);
  return (
    <BoardGridContainer
      rows={board.length ?? 0}
      columns={board.at(0)?.length ?? 0}
      className={className}
      heading={heading}
    >
      <Grid board={board} {...interactiveProps} />
    </BoardGridContainer>
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

const Grid: FC<Pick<TProps, "board" | "disabled"> & TInteractivityProps> = ({
  board,
  ...interactiveProps
}) => {
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

const Cell: FC<TCell> = ({ status, coords, disabled, ...interactiveProps }) => {
  const Tag = interactiveProps.isInteractive ? "button" : "div";
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const modifier = e.ctrlKey || e.metaKey;
      if (interactiveProps.isInteractive)
        interactiveProps.onClick(coords, modifier);
    },
    [coords, interactiveProps],
  );
  return (
    <Tag
      aria-label={`Cell ${coords.x},${coords.y} - ${status}`}

      className={styles.Cell}
      data-disabled={disabled ? "" : undefined}
      data-interactive={interactiveProps.isInteractive ? "" : undefined}
      onClick={interactiveProps.isInteractive ? handleClick : undefined}

      data-type={status === ECellStatus.Empty ? undefined : status}
    >
      {`${status}`.charAt(0)}
    </Tag>
  );
};
