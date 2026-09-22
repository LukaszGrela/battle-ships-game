import { FC } from "react";
import { useSocket } from "../../socket";
import { Button } from "../Button/Button";
import { Power } from "../icons";
import { TButtonProps } from "../Button/types";

export const DisconnectButton: FC<Pick<TButtonProps, "className" | "size">> = ({
  className,
  size,
}) => {
  const { disconnect } = useSocket();
  return (
    <Button
      className={className}
      type="danger"
      onClick={disconnect}
      size={size}
    >
      <span>Disconnect</span>
      <Power />
    </Button>
  );
};
