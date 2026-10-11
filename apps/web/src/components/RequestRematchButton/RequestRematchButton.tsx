import { FC, useEffect, useState } from "react";
import { Button, TButtonProps } from "../Button";
import { socket } from "../../socket";
import { useGameStore } from "../../store/useGameStore";

export const RequestRematchButton: FC<Pick<TButtonProps, "size">> = ({
  size,
}) => {
  const { gameState } = useGameStore();
  const [requestSent, setRequestSent] = useState(
    () => !!gameState?.rematchRequest,
  );

  const handleRequestRematch = () => {
    setRequestSent(true);
    socket.emit("request_rematch");
  };

  useEffect(() => {
    if (
      requestSent &&
      gameState?.rematchRequest &&
      gameState.rematchRequest.status !== "pending"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRequestSent(false);
    }
  }, [gameState?.rematchRequest, requestSent]);

  return (
    <Button
      size={size}
      onClick={handleRequestRematch}
      disabled={requestSent || !!gameState?.rematchRequest}
    >
      Give me revenge
    </Button>
  );
};
