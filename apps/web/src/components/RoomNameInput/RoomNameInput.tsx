import { ReactNode } from "react";
import styles from "./RoomNameInput.module.css";
import { Hourglass, Close, Tick } from "../icons";
import { classNames } from "../../utils/classNames";

interface RoomNameInputProps {
  className?: string;

  status: "idle" | "invalid" | "valid" | "taken" | "pending";
  value: string;

  onChange: React.ChangeEventHandler<HTMLInputElement, HTMLInputElement>;

  /**
   * end slot
   */
  children?: ReactNode;
}

export function RoomNameInput({
  value,
  onChange,
  status,
  children,
  className,
}: RoomNameInputProps) {
  return (
    <div
      className={classNames(styles.RoomNameInput, className)}
      data-status={status}
    >
      <label className={styles.RoomNameInput_label} htmlFor="war-room-input">
        Room name
      </label>
      <div className={styles.RoomNameInput_field} data-status={status}>
        <input
          className={styles.RoomNameInput_input}
          id="war-room-input"
          type="text"
          placeholder="e.g. Gulf-Broadside"
          value={value}
          onChange={onChange}
          data-status={status}
        />

        {/* Status indicator badge */}
        <span className={styles.RoomNameInput_badge}>
          {status === "pending" && <Hourglass />}
          {status === "valid" && <Tick />}
          {status === "taken" && <Close />}
        </span>
        {children}
      </div>
    </div>
  );
}
