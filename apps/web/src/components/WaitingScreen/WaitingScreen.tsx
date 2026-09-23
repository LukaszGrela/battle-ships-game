import { useEffect, useMemo, useRef } from "react";
import styles from "./WaitingScreen.module.css";
import { IPlayer } from "@repo/types";
import { seedRandom } from "@repo/game-logic";
import { socket } from "../../socket";
import { classNames } from "../../utils/classNames";
import { DotLoader } from "../DotLoader";
import { Waves } from "../Waves";

interface WaitingScreenProps {
  className?: string;
  player: IPlayer;
  onOpponentFound?: () => void;
}

const getPirateMessages = (name: string): string[] => [
  `Ahoy, ${name}! The tides are turning, waiting for a worthy challenger...`,
  `Steady your ship, ${name}. We're scanning the horizon for your foe.`,
  `Keep your powder dry, ${name}. A scallywag is bound to cross your path soon.`,
  `Listen here, ${name}: the sea is restless, but your opponent is nigh.`,
  `Patience, ${name}. Even the great Blackbeard had to wait for the wind.`,
  `The rum is cold, ${name}, and we're just waiting for one more soul to join the fray.`,
];

const LOADER_MESSAGES = [
  "Scouring the Seven Seas",
  "Scanning the horizon",
  "Hoisting the mainsail",
  "Priming the cannons",
  "Consulting the charts",
  "Waiting on the tide",
  "Hailing nearby ships",
  "Piercing through the mist",
  "Rallying the crew",
  "Weighing the anchor",
] as const;

export function WaitingScreen({
  player,
  onOpponentFound,
  className,
}: WaitingScreenProps) {
  const bellSound = useRef<HTMLAudioElement | null>(null);

  const random = useMemo(() => seedRandom(player.seed), [player.seed]);
  // Lock in one message for this waiting session
  const message = useMemo(() => {
    const messages = getPirateMessages(player.name);
    return messages[random.nextInt(0, messages.length - 1)];
  }, [player, random]);

  const loaderMessage = useMemo(
    () => LOADER_MESSAGES[random.nextInt(0, LOADER_MESSAGES.length - 1)],
    [random],
  );

  useEffect(() => {
    bellSound.current = new Audio("/sounds/ship_bell.mp3");

    const handleOpponentConnected = () => {
      bellSound.current?.play().catch((err) => {
        console.warn("Audio play blocked by browser:", err);
      });
      onOpponentFound?.();
    };

    socket.on("opponent_connected", handleOpponentConnected);
    return () => {
      socket.off("opponent_connected", handleOpponentConnected);
    };
  }, [onOpponentFound]);

  return (
    <div className={classNames(styles.screen, className)}>
      <div className={styles.ship} role="img" aria-label="Sailing ship">
        ⚓
      </div>

      <h2 className={styles.title}>Awaiting Challenger</h2>

      <p className={styles.message}>{message}</p>

      <div className={styles.waves} aria-hidden="true" />
      <Waves className={styles.wave} direction="right"/>
      <DotLoader className={styles.loader} label={loaderMessage} />
    </div>
  );
}
