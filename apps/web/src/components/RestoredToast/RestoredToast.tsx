import { useEffect } from "react";
import styles from "./RestoredToast.module.css";
import {
  RESTORED_TOAST_MS,
  useConnectionStatus,
} from "../../store/useConnectionStatus";

/**
 * One short confirmation after a planned restart brought the player back.
 * It disappears on its own; nothing here needs a click.
 */
export const RestoredToast = () => {
  const restoredAt = useConnectionStatus((state) => state.restoredAt);
  const dismissRestored = useConnectionStatus((state) => state.dismissRestored);

  useEffect(() => {
    if (!restoredAt) return;
    const timer = setTimeout(dismissRestored, RESTORED_TOAST_MS);
    return () => clearTimeout(timer);
  }, [restoredAt, dismissRestored]);

  if (!restoredAt) return null;

  return (
    <output className={styles.RestoredToast} aria-live="polite">
      Game restored — welcome back on deck.
    </output>
  );
};
