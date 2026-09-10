import type { FC, PropsWithChildren } from "react";
import { useGameStore } from "../../store/useGameStore";
import { socket } from "../../socket";
import { Button } from "../Button/Button";

export const EmitLeaveGameButton: FC<PropsWithChildren<{}>> = ({
  children = "Leave Game",
}) => {
  const { selfId, gameState, setGameState, setSelfId, setError } =
    useGameStore();
  const gameFinished = gameState?.phase === "finished";
  console.log("[EmitLeaveGameButton]", "Game finished", gameFinished);
  const leaveGame = () => {
    if (gameFinished) {
      setGameState(null);
      setSelfId(null);
      setError(null);
    } else {
      socket.emit("leave_game");
    }
  };
  return (
    <Button onClick={leaveGame} disabled={!!selfId === false}>
      {children}
    </Button>
  );
};
