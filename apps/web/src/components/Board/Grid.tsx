import styles from "./BoardGrid.module.css";
import { FC, useMemo } from "react";
import { TInteractivityProps, TProps } from "./types";
import { Cell } from "./Cell";
import { ECellStatus } from "@repo/types";
import { paddedGrid, seedRandom } from "@repo/game-logic";

type TMargin = { type: "margin" };
type TCell = {
  type: "cell";
  cellData: ECellStatus;
};

type TGridData = {
  x: number;
  y: number;
  rowsLength: number;
  columnsLength: number;
} & (TMargin | TCell);

export const Grid: FC<
  Pick<TProps, "board" | "disabled" | "pad"> & TInteractivityProps
> = ({ board, pad = 1, ...interactiveProps }) => {
  const random = seedRandom(1979);
  const inert = interactiveProps.disabled;

  const flatBoard: Array<TGridData> = useMemo(() => {
    const paddedCopy = paddedGrid<ECellStatus, ECellStatus | TMargin>(
      board,
      pad,
      () => ({ type: "margin", x: -1, y: -1 }),
    );
    return paddedCopy.flatMap((rowData, row, { length: rowsLength }) => {
      return rowData.map((cellData, column, { length: columnsLength }) => {
        if (typeof cellData === "object" && cellData.type === "margin") {
          return {
            ...cellData,
            x: column,
            y: row,
            rowsLength,
            columnsLength,
          };
        }

        return {
          type: "cell",
          cellData,
          x: column,
          y: row,
          rowsLength,
          columnsLength,
        } as TCell;
      });
    }) as Array<TGridData>;
  }, [board, pad]);

  return (
    <div className={styles.Grid} inert={inert}>
      {flatBoard.map((item) => {
        const { x, y, rowsLength, columnsLength } = item;
        if (item.type === "margin") {
          return (
            <Cell
              key={`${x}:${y}`}
              coords={{ x, y }}
              status={ECellStatus.Margin}

              lastColumn={x === columnsLength - 1 ? "" : undefined}
              lastRow={y === rowsLength - 1 ? "" : undefined}
              firstColumn={x === 0 ? "" : undefined}
              firstRow={y === 0 ? "" : undefined}
              disabled
              isInteractive={false}
            />
          );
        }

        return (
          <Cell
            key={`${x}:${y}`}
            status={item.cellData}
            coords={{ x: x - pad, y: y - pad }}

            lastColumn={x === columnsLength - 1 ? "" : undefined}
            lastRow={y === rowsLength - 1 ? "" : undefined}
            firstColumn={x === 0 ? "" : undefined}
            firstRow={y === 0 ? "" : undefined}
            // 4x4 number of frames from explosion/splash atlas
            frameIndex={random.nextInt(0, 15)}

            {...interactiveProps}
          />
        );
      })}
    </div>
  );
};
