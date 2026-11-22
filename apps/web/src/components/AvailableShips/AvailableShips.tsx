import styles from "./AvailableShips.module.css";
import { TShip } from "@repo/types";
import { FC, ReactNode, useCallback } from "react";
import { Button } from "../Button/Button";

export const AvailableShips: FC<{
  ships: (TShip & { type: "pending" })[];

  selected: number | null;
  onSelection: (shipId: number | null) => void;

  disabled?: boolean;

  children?: ReactNode;
}> = ({ ships, onSelection, selected, disabled, children }) => {
  const handleClick = useCallback(
    (ship: TShip) => () => {
      if (ship.id === selected) {
        onSelection(null);
      } else {
        onSelection(ship.id);
      }
    },
    [onSelection, selected],
  );

  return (
    <div className={styles.AvailableShips}>
      <div className={styles.GridSlot}>
        {ships.map((ship) => {
          const { id, size, placed } = ship;
          return (
            <Button
              type="custom"
              key={id}
              className={styles.Option}
              data-placed={placed ? "" : undefined}
              data-selected={selected === ship.id ? "" : undefined}

              onClick={handleClick(ship)}

              disabled={disabled}
            >
              <Ship size={size} />
              <span className={styles.Option_label}>{size}</span>
            </Button>
          );
        })}
      </div>
      {children}
    </div>
  );
};

const Ship: FC<{
  size: number;
  vertical?: boolean;
}> = ({ vertical, size }) => {
  return (
    <div
      className={styles.Ship}
      data-vertical={vertical ? "" : undefined}
      data-size={size}
    >
      {Array.from(Array(size)).map((_, index) => (
        <span key={`${size}-${index}`} />
      ))}
    </div>
  );
};
