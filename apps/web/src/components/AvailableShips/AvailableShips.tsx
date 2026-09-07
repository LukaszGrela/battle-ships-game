import styles from "./AvailableShips.module.css";
import { TShip } from "@repo/types";
import { FC, useCallback } from "react";

export const AvailableShips: FC<{
  ships: (TShip & { type: "pending" })[];

  selected: TShip | null;
  onSelection: (ship: TShip | null) => void;
  onApply: () => void;
  onReset: () => void;

  disabled?: boolean;
}> = ({ ships, onSelection, selected, onApply, onReset, disabled }) => {
  const handleClick = useCallback(
    (ship: TShip) => () => {
      console.log("handleClick", ship);
      if (ship.id === selected?.id) {
        onSelection(null);
      } else {
        onSelection(ship);
      }
    },
    [onSelection, selected],
  );

  const disableApply = ships.some((needle) => !needle.placed) || disabled;
  const disableReset = !ships.some((needle) => needle.placed) || disabled;

  return (
    <div>
      <h2>Dostępne statki</h2>
      <div className={styles.GridSlot}>
        {ships.map((ship) => {
          const { id, size, placed } = ship;

          return (
            <button
              key={id}
              className={styles.Option}
              data-placed={placed ? "" : undefined}
              data-selected={selected?.id === ship.id ? "" : undefined}

              onClick={handleClick(ship)}

              disabled={placed || disabled}
            >
              <Ship size={size} />
            </button>
          );
        })}
      </div>
      <div>
        Użyj modyfikatora <kbd>CTRL</kbd>/<kbd>CMD</kbd> żeby ustawić statek
        pionowo.
      </div>
      <div>
        <button onClick={onReset} disabled={disableReset}>
          Zresetuj
        </button>
        <button onClick={onApply} disabled={disableApply}>
          Gotowe
        </button>
      </div>
    </div>
  );
};

const Ship: FC<{
  size: number;
  vertical?: boolean;
}> = ({ vertical, size }) => {
  return (
    <div className={styles.Ship} data-vertical={vertical ? "" : undefined}>
      {Array.from(Array(size)).map((_, index) => (
        <span key={`${size}-${index}`} />
      ))}
    </div>
  );
};
