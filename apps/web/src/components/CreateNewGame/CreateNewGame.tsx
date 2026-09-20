import styles from "./CreateNewGame.module.css";

import {
  useState,
  useTransition,
  useDeferredValue,
  useEffect,
  startTransition,
  FC,
  useActionState,
  useCallback,
} from "react";
import { socket } from "../../socket";
import { RoomNameInput } from "../RoomNameInput/RoomNameInput";
import { Button } from "../Button/Button";
import { AnchorIcon, RandomizeIcon } from "../icons";
import { classNames } from "../../utils/classNames";
import { DecoratedContainer } from "../DecoratedContainer";

export const CreateNewGame: FC<{ className?: string }> = ({ className }) => {
  const [inputValue, setInputValue] = useState("");
  const [isChecking, startCheckingTransition] = useTransition();
  const [isUnique, setIsUnique] = useState<boolean | null>(null);

  const deferredValue = useDeferredValue(inputValue, "");
  const trimmed = deferredValue.trim();

  // 1. Calculate synchronous formatting status during render (No setState in Effect!)
  const isTooShort = trimmed.length > 0 && trimmed.length < 3;
  const isEmpty = trimmed.length === 0 && deferredValue.length > 0;

  // 2. Derive overall status directly
  let status: "idle" | "invalid" | "empty" | "valid" | "taken" = "idle";
  if (isTooShort) {
    status = "invalid";
  } else if (isEmpty) {
    status = "empty";
  } else if (!isEmpty && isUnique !== null) {
    status = isUnique ? "valid" : "taken";
  }

  // 3. Synchronize asynchronous backend check only
  useEffect(() => {
    // If format is invalid or empty, do not run network check
    if (trimmed.length < 3) {
      return;
    }

    let isCurrent = true;

    startCheckingTransition(async () => {
      try {
        const proposition = await socket.emitWithAck(
          "get_war_room_name",
          trimmed,
        );

        const unique = proposition === trimmed;

        if (isCurrent) {
          setIsUnique(unique);
          setInputValue(trimmed);
        }
      } catch (err) {
        console.error("Socket error during name check:", err);
        if (isCurrent) {
          setIsUnique(null);
        }
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [trimmed]);

  // Loading indicator combines React's deferred delay + in-flight socket request
  const isValidationPending =
    !isEmpty && !isTooShort && (inputValue !== deferredValue || isChecking);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInputValue(nextVal);
    // Reset validity state while typing
    setIsUnique(null);
  };

  const handleRandomName = (name: string | null) => {
    if (name) {
      setInputValue(name);
    }
  };

  const createGameHandler = useCallback(() => {
    if (inputValue) socket.emit("join_game", inputValue);
  }, [inputValue]);

  const inputstatus = status === "empty" ? "invalid" : status;
  return (
    <DecoratedContainer
      className={classNames(styles.CreateNewGame, className)}
      header={<span className={styles.shadow}>Create new game</span>}
    >
      <div className={styles.CreateNewGame_container}>
        <div className={styles.input_row}>
          <RoomNameInput
            className={styles.RoomNameInput}
            value={inputValue}
            onChange={handleInputChange}
            status={isValidationPending ? "pending" : inputstatus}
          ></RoomNameInput>
          <RandomGameName
            onNewGame={handleRandomName}
            className={styles.randomName}
          />
          {/* Helper messages */}
          <div className={styles.RoomNameInput_error} data-status={status}>
            {isValidationPending && (
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
            {status === "empty" && (
              <span className={styles.invalid}>Name can't be empty.</span>
            )}
          </div>
        </div>

        <Button
          onClick={createGameHandler}
          disabled={!inputValue}
          type="primary"
          className={styles.createGame}
        >
          <AnchorIcon />
          <span>Create Game</span>
          <AnchorIcon />
        </Button>
      </div>
    </DecoratedContainer>
  );
};

const RandomGameName: FC<{
  onNewGame: (name: string | null) => void;
  className?: string;
}> = ({ onNewGame, className }) => {
  const [, triggerRandomName, isPending] = useActionState(
    async (_previousName: string | null) => {
      // get random name
      const name = await requestRoomName(null);
      onNewGame(name);
      return name;
    },
    null,
  );

  const handleClick = () => {
    // startTransition tells React to track pending state for useActionState
    startTransition(() => {
      triggerRandomName();
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      type="info"
      className={className}
    >
      <span>Random name</span>
      <RandomizeIcon />
    </Button>
  );
};

async function requestRoomName(
  proposition: string | null,
): Promise<string | null> {
  try {
    const roomName = await socket.emitWithAck("get_war_room_name", proposition);
    return roomName; // Returns "Gulf-Broadside" or null
  } catch (error) {
    console.error("Failed to fetch room name:", error);
    return null;
  }
}
