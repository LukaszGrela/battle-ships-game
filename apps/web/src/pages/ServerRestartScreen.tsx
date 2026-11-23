import { useEffect, useMemo, useState } from "react";
import styles from "./ServerRestartScreen.module.css";
import { GrelaDesign } from "../components/GrelaDesign/GrelaDesign";
import { useConnectionStatus } from "../store/useConnectionStatus";
import { Waves } from "../components/Waves";

const TICK_MS = 250;

const text = {
  restart: {
    title: "The ship is entering port",
    lead: "The server is in dry dock — we will be back on the open sea shortly.",
    saved: "Your game is saved. Crew, boards and ships are waiting in port.",
    counting: (seconds: number) => `Back on deck in ${seconds}s…`,
    waiting: "Furling the sails and trying to reconnect…",
    hint: "Do not close this tab. The connection restores itself.",
  },
  shutdown: {
    title: "The anchor is down",
    lead: "The server has been stopped — the captain has gone ashore.",
    saved:
      "Your game is saved and waiting in port. When the server is up again, you will be back on deck.",
    counting: (seconds: number) =>
      `The port is silent. Ringing the bell in ${seconds}s…`,
    waiting: "The port is still silent — retrying the connection…",
    hint: "Do not close this tab. When the server returns, the game restores itself.",
  },
} as const;

/**
 * Shown when the server announced a planned restart instead of just dropping
 * the socket. It deliberately has no "Connect" button: reconnecting is handled
 * by Socket.IO and a manual retry would only race it.
 */
export const ServerRestartScreen = () => {
  const { restartNotice, restartAt } = useConnectionStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const reason = restartNotice?.reason ?? "restart";
  const copy = text[reason];

  const { seconds, waiting } = useMemo(() => {
    const graceMs = restartNotice?.graceMs ?? 0;
    const elapsed = Math.max(0, now - (restartAt ?? now));
    const remainingMs = Math.max(0, graceMs - elapsed);
    return {
      seconds: Math.ceil(remainingMs / 1000),
      waiting: remainingMs === 0,
    };
  }, [now, restartAt, restartNotice]);

  return (
    <section className={styles.ServerRestartScreen}>
      <div className={styles.container}>
        <img
          alt="Pirates - BattleShips"
          src="/assets/title-2-128.png"
          className={styles.logo}
        />
        <p className={styles.eyebrow}>{copy.lead}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.saved}>{copy.saved}</p>

        <p className={styles.countdown} aria-live="polite">
          {waiting ? copy.waiting : copy.counting(seconds)}
        </p>

        {!waiting && (
          <div
            className={styles.progress}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (seconds * 1000 * 100) / Math.max(1, restartNotice?.graceMs ?? 1),
            )}
          >
            <span
              className={styles.progressFill}
              style={{
                width: `${Math.min(
                  100,
                  (seconds * 1000 * 100) /
                    Math.max(1, restartNotice?.graceMs ?? 1),
                )}%`,
              }}
            />
          </div>
        )}

        <Waves className={styles.waves} />
        <p className={styles.hint}>{copy.hint}</p>
      </div>
      <GrelaDesign className={styles.footerLogo} />
    </section>
  );
};
