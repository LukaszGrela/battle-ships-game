import { FC } from "react";

export const PlayerDetails: FC<{
  id: string;
  name: string;
}> = ({ id, name }) => {
  return (
    <div>
      <span>{name}</span>
      <span>User id: {id}</span>
    </div>
  );
};
