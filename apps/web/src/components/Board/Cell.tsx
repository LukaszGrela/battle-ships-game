import styles from "./BoardGrid.module.css";
import { FC, useCallback, MouseEvent, CSSProperties } from "react";
import { TCell } from "./types";
import { ECellStatus } from "@repo/types";

export const Cell: FC<TCell> = ({
  status,
  coords,
  disabled,
  firstColumn,
  firstRow,
  lastColumn,
  lastRow,
  explosionIndex = 0,
  ...interactiveProps
}) => {
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

      data-col={coords.x}
      data-row={coords.y}
      data-first-column={firstColumn}
      data-first-row={firstRow}
      data-last-column={lastColumn}
      data-last-row={lastRow}
      style={
        {
          "--cell-explosion-index": explosionIndex,
        } as CSSProperties
      }
      data-explosion-index={explosionIndex}
    />
  );
};
