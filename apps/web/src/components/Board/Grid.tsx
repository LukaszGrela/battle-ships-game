import styles from "./BoardGrid.module.css";
import { FC, useMemo } from "react";
import { TInteractivityProps, TProps } from "./types";
import { Cell } from "./Cell";
import { ECellStatus } from "@repo/types";
import { seedRandom } from "@repo/game-logic";

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
            // 3 number of frames from explosion atlas
            explosionIndex={random.nextInt(0, 2)}

            {...interactiveProps}
          />
        );
      })}
    </div>
  );
};

const paddedArray = <T, C = T>(
  array: T[],
  pad: number,
  paddedContent: () => C,
): (T | C)[] => {
  if (pad <= 0) return array;

  // shift and push
  const paddedList = array.concat() as (T | C)[];
  let i = 0;
  while (i < pad) {
    i++;
    // start and end
    paddedList.unshift(paddedContent());
    paddedList.push(paddedContent());
  }

  return paddedList as T[];
};

const paddedGrid = <T, C>(
  array: T[][],
  pad: number,
  paddedContent: () => C,
): Array<T | C>[] => {
  if (pad <= 0) return array as Array<T | C>[];

  const list = array.concat().map((row) => {
    // dodaj padding - (ekstra kolumny)
    return paddedArray(row, pad, paddedContent);
  });

  const emptyRow = () => {
    const rowsLength = array.at(0)?.length ?? 0;
    return Array.from(Array(rowsLength + pad * 2)).map(() => paddedContent());
  };
  // dodaj padding - ekstra wiersze
  return paddedArray<(T | C)[], C[]>(list, pad, emptyRow) as Array<T | C>[];
};
/*
console.group("TEST PADDED ARRAY");
console.log(
  "EMPTY",
  paddedArray([], 0, () => {}),
);
console.log(
  "EMPTY",
  paddedArray([1, 2, 3], 0, () => -1),
);
console.log(
  "EMPTY",
  paddedArray([1, 2, 3], -1, () => -1),
);
console.log(
  "PAD 1",
  paddedArray([1, 2, 3], 1, () => -1),
);
console.log(
  "PAD 2",
  paddedArray([1, 2, 3], 2, () => -1),
);
console.log(
  "PAD 3",
  paddedArray([1, 2, 3], 3, () => -1),
);
console.groupEnd();
console.group("TEST PADDED GRID");
console.log(
  "EMPTY",
  paddedGrid([], 0, () => {}),
);
console.log(
  "EMPTY",
  paddedGrid([[1, 2, 3]], 0, () => -1),
);
console.log(
  "EMPTY",
  paddedGrid([[1, 2, 3]], -1, () => -1),
);
console.log(
  "PAD 1",
  paddedGrid([[1, 2, 3]], 1, () => -1),
);
console.log(
  "PAD 2",
  paddedGrid([[1, 2, 3]], 2, () => -1),
);
console.log(
  "PAD 3",
  paddedGrid([[1, 2, 3]], 3, () => -1),
);
console.groupEnd();
*/
