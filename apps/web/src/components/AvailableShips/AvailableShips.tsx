import { FC } from "react";

export const AvailableShips: FC<{
  shipsLeft: number[];
}> = ({ shipsLeft }) => {
  return (
    <div>
      <h2>Dostępne statki</h2>
      <div>{shipsLeft}</div>
    </div>
  );
};
