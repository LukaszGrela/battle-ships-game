import { FC } from "react";
import { useSocket } from "../../socket";
import { Button } from "../Button/Button";
import { Power } from "../icons";

export const DisconnetButton: FC<{ className?: string }> = ({ className }) => {
  const { disconnect } = useSocket();
  return (
    <Button className={className} type="danger" onClick={disconnect}>
      <span>Disconnect</span>
      <Power />
    </Button>
  );
};
