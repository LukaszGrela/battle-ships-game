import styles from "./GameResultsModal.module.css";
import { FC, useState } from "react";
import { TProps as TModalProps, Modal } from "../Modal";
import { TGameState } from "@repo/types";
import { EmitLeaveGameButton } from "../EmitLeaveGameButton/EmitLeaveGameButton";
import { classNames } from "../../utils/classNames";
import { getSpriteStyle } from "../../assets/getSpriteStyle";
import {
  DECOR_SPRITES,
  DEFEAT_SPRITES,
  TDecorSprite,
  VICTORY_SPRITES,
} from "../../assets/decorations";
import { RequestRematchButton } from "../RequestRematchButton/RequestRematchButton";

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

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export const GameResultsModal: FC<TProps> = ({ open, onClose, gameState }) => {
  const state =
    gameState && gameState.phase === "finished" ? gameState : undefined;
  const myResults = state?.result[state.self.id];
  const winner = myResults === "win";

  const [message] = useState(() => {
    const list = winner ? VICTORY_MESSAGES : DEFEAT_MESSAGES;

    return pick(list);
  });

  const [decor] = useState<TDecorSprite>(() =>
    pick(winner ? VICTORY_SPRITES : DEFEAT_SPRITES),
  );

  const sprite = DECOR_SPRITES[decor];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}

        title={winner ? "Victory!" : "Game Over"}
        className={styles.GameResultsModal}
        dialogClassName={styles.GameResultsModal_panel}
        headerClassName={styles.GameResultsModal_header}
        bodyClassName={classNames(styles.GameResultsModal_body, styles.body)}

        aria-labelledby={"results-modal-title"}
        data-outcome={myResults}

        footer={() => (
          <>
            {!winner && <RequestRematchButton />}

            <EmitLeaveGameButton type="secondary" skipConfirmation={true}>
              Sail Away
            </EmitLeaveGameButton>
          </>
        )}
      >
        <div
          className={styles.decor}
          aria-hidden={true}
          style={getSpriteStyle(sprite, 128)}
        />

        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      </Modal>
    </>
  );
};
