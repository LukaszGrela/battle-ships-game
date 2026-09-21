import type { FC, PropsWithChildren } from "react";
import { useGameStore } from "../../store/useGameStore";
import { socket } from "../../socket";
import { Button } from "../Button/Button";
import { TButtonProps } from "../Button/types";

export const EmitLeaveGameButton: FC<
  PropsWithChildren<Pick<TButtonProps, "type" | "className">>
> = ({ children = "Leave Game", type, className }) => {
  const { selfId, gameState, setGameState, setSelfId, setError } =
    useGameStore();
  const gameFinished = gameState?.phase === "finished";
  console.log("[EmitLeaveGameButton]", "Game finished", gameFinished);
  const leaveGame = () => {
    if (gameFinished) {
      setGameState(null);
      setSelfId(null);
      setError(null);
    }
    socket.emit("leave_game");
  };
  return (
    <Button
      className={className}
      onClick={leaveGame}
      disabled={!!selfId === false}
      type={type}
    >
      {children}
    </Button>
  );
};
