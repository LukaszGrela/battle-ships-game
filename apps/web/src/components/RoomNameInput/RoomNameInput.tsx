import { ReactNode } from "react";
import styles from "./RoomNameInput.module.css";

interface RoomNameInputProps {
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
}: RoomNameInputProps) {
  return (
    <div className={styles.RoomNameInput} data-status={status}>
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
          {status === "pending" && "⏳"}
          {status === "valid" && "✅"}
          {status === "taken" && "❌"}
        </span>
        {children}
      </div>

      {/* Helper messages */}
      <div className={styles.RoomNameInput_error} data-status={status}>
        {status === "pending" && (
          <span className={styles.pending}>Checking availability...</span>
        )}
        {status === "valid" && (
          <span className={styles.valid}>Name is available!</span>
        )}
        {status === "taken" && (
          <span className={styles.taken}>
            This war room name is already in use.
          </span>
        )}
        {status === "invalid" && (
          <span className={styles.invalid}>
            Name must be at least 3 characters.
          </span>
        )}
      </div>
    </div>
  );
}
