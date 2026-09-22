import styles from "./AvailableShips.module.css";
import { TShip } from "@repo/types";
import { FC, useCallback, useState } from "react";
import { Button } from "../Button/Button";

export const AvailableShips: FC<{
  ships: (TShip & { type: "pending" })[];

  selected: TShip | null;
  onSelection: (ship: TShip | null) => void;
  onApply: () => void;
  onReset: () => void;

  disabled?: boolean;
}> = ({ ships, onSelection, selected, onApply, onReset, disabled }) => {
  const [vertical, setVertical] = useState(false);

  const handleVerticalCheckbox: React.ChangeEventHandler<
    HTMLInputElement,
    HTMLInputElement
  > = (e) => {
    setVertical(!!e.target.checked);
  };

  const handleClick = useCallback(
    (ship: TShip) => () => {
      console.log("handleClick", ship);
      if (ship.id === selected?.id) {
        onSelection(null);
      } else {
        onSelection({
          ...ship,
          orientation: vertical ? "vertical" : "horizontal",
        });
      }
    },
    [onSelection, selected, vertical],
  );

  const disableApply = ships.some((needle) => !needle.placed) || disabled;
  const disableReset = !ships.some((needle) => needle.placed) || disabled;

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
              data-selected={selected?.id === ship.id ? "" : undefined}

              onClick={handleClick(ship)}

              disabled={placed || disabled}
            >
              <Ship size={size} />
              <span className={styles.Option_label}>{size}</span>
            </Button>
          );
        })}
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={vertical}
            onChange={handleVerticalCheckbox}
          />
          Vertical orientation
        </label>
      </div>
      <div>
        <Button type="secondary" onClick={onReset} disabled={disableReset}>
          Reset
        </Button>
        <Button onClick={onApply} disabled={disableApply}>
          Ready
        </Button>
      </div>
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
