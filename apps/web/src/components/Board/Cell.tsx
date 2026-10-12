import styles from "./BoardGrid.module.css";
import { FC, useCallback, MouseEvent, CSSProperties, useMemo } from "react";
import { TCell } from "./types";
import { ECellStatus } from "@repo/types";
import { getSpriteStyle } from "../../assets/getSpriteStyle";
import { EXPLOSION_ATLAS, EXPLOSION_SPRITES } from "../../assets/explosions";
import { SPLASH_ATLAS, SPLASH_SPRITES } from "../../assets/splashes";

export const Cell: FC<TCell> = ({
  status,
  coords,
  disabled,
  firstColumn,
  firstRow,
  lastColumn,
  lastRow,
  frameIndex = 0,
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

  const style = useMemo((): CSSProperties | undefined => {
    if (status === ECellStatus.Empty) return undefined;

    const frame = (status === ECellStatus.Margin
      ? SPLASH_ATLAS[SPLASH_SPRITES[frameIndex] ?? 0]
      : EXPLOSION_ATLAS[EXPLOSION_SPRITES[frameIndex] ?? 0]) ?? {
      x: 0,
      y: 0,
    };

    return {
      "--cell-frame-index": frameIndex,
      "--cell-frame-x": frame.x,
      "--cell-frame-y": frame.y,
    } as CSSProperties;
  }, [frameIndex, status]);

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
      style={style}
      data-frame-index={frameIndex}
    />
  );
};
