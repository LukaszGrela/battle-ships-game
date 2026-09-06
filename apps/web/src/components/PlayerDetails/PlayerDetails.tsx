import { FC } from "react";

export const PlayerDetails: FC<{
  selfId: string;
}> = ({ selfId }) => {
  return (
    <div>
      <span>User id: {selfId}</span>
    </div>
  );
};
