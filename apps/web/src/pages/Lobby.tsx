import {
  FC,
  PropsWithChildren,
  startTransition,
  useActionState,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
} from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useConnectionStatus } from "../store/useConnectionStatus";
import { socket, useSocket } from "../socket";
import { useOpenGamesStore } from "../store/useOpenGamesStore";
import { RoomNameInput } from "../components/RoomNameInput/RoomNameInput";

export const Lobby: FC = () => {
  const { connected } = useConnectionStatus();

  return (
    <AppLayout>
      <h2>Lobby</h2>
      {connected && <ConnectedLobby />}
      {!connected && <Connect />}
    </AppLayout>
  );
};

const Connect = () => {
  const { connect } = useSocket();
  return (
    <section>
      <button onClick={connect}>Connect to the Battleships Game server</button>
    </section>
  );
};

const ConnectedLobby = () => {
  return (
    <section>
      <JoinNewGame />
      <OpenGames />
    </section>
  );
};

const JoinNewGame = () => {
  const [inputValue, setInputValue] = useState("");
  const [isChecking, startCheckingTransition] = useTransition();
  const [isUnique, setIsUnique] = useState<boolean | null>(null);

  const deferredValue = useDeferredValue(inputValue, "");
  const trimmed = deferredValue.trim();

  // 1. Calculate synchronous formatting status during render (No setState in Effect!)
  const isTooShort = trimmed.length > 0 && trimmed.length < 3;
  const isEmpty = trimmed.length === 0;

  // 2. Derive overall status directly
  let status: "idle" | "invalid" | "valid" | "taken" = "idle";
  if (isTooShort) {
    status = "invalid";
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

  return (
    <div className="JoinNewGame">
      <RoomNameInput
        value={inputValue}
        onChange={handleInputChange}
        status={isValidationPending ? "pending" : status}
      >
        <RandomGameName onNewGame={handleRandomName} />
      </RoomNameInput>
      <EmitJoinGameButton room={inputValue} disabled={!inputValue} />
    </div>
  );
};

const OpenGames = () => {
  const { openGames } = useOpenGamesStore();
  return (
    <section>
      <h3>Open games</h3>
      {openGames.length > 0 && (
        <ul>
          {openGames.map((warRoomName: string) => (
            <li key={warRoomName}>
              <span>{warRoomName}</span>
              <EmitJoinGameButton room={warRoomName}>
                Join game
              </EmitJoinGameButton>
            </li>
          ))}
        </ul>
      )}
      {!openGames.length && <div>No open games available. Create Game.</div>}
    </section>
  );
};

const EmitJoinGameButton: FC<
  PropsWithChildren<{
    disabled?: boolean;
    room?: string;
  }>
> = ({ disabled, children = "Create Game", room }) => {
  const joinGame = useCallback(() => {
    if (room) socket.emit("join_game", room);
  }, [room]);
  return (
    <button onClick={joinGame} disabled={disabled}>
      {children}
    </button>
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

const RandomGameName: FC<{
  onNewGame: (name: string | null) => void;
}> = ({ onNewGame }) => {
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
    <button onClick={handleClick} disabled={isPending}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-dices-icon lucide-dices"
      >
        <rect width="12" height="12" x="2" y="10" rx="2" ry="2" />
        <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
        <path d="M6 18h.01" />
        <path d="M10 14h.01" />
        <path d="M15 6h.01" />
        <path d="M18 9h.01" />
      </svg>
    </button>
  );
};
