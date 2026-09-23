import styles from "./GameResultsModal.module.css";
import { FC } from "react";
import { TProps as TModalProps, Modal } from "../Modal";
import { TGameState } from "@repo/types";

type TProps = {
  gameState: TGameState;
} & Pick<TModalProps, "open" | "onClose">;

const VICTORY_MESSAGES = [
  "The gold is yours, Captain!",
  "You sent 'em straight to Davy Jones!",
  "The Seven Seas bow to your might.",
  "A glorious and bloody plunder!",
  "Victory tastes like spiced rum.",
  "The enemy sleeps with the fishes.",
  "You rule the waves today!",
  "Crown the king of the scallywags.",
  "An empire built on gold and salt.",
  "No foe could match your steel.",
] as const;

const DEFEAT_MESSAGES = [
  "Your ship sleeps in the deep.",
  "Davy Jones claims another soul...",
  "A watery grave awaits your crew.",
  "Your loot is lost to the abyss.",
  "The sea swallowed your ambitions.",
  "Walked the plank, did we?",
  "The sharks have your measure now.",
  "A bitter pill, washed down with sea water.",
  "Your flag flies upside down today.",
  "Live to patch the hull and fight another day.",
] as const;

export const GameResultsModal: FC<TProps> = ({ open, onClose, gameState }) => {
  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];

  return (
    <Modal
      open={open}
      onClose={onClose}
      header={() => {
        <h2>Game Over</h2>;
      }}

      dialogClassName={styles.GameResultsModal_panel}
      bodyClassName={styles.GameResultsModal_body}
    >
      {myResults && (
        <section>{myResults === "win" ? "Wygrałeś!" : "Przegrałeś!"}</section>
      )}
    </Modal>
  );
};
