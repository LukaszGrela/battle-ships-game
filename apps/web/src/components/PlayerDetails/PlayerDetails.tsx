import styles from "./PlayerDetails.module.css";
import { IPlayer } from "@repo/types";
import { FC } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import { PlayerAvatar } from "../PirateAvatar/PirateAvatar";
import { classNames } from "../../utils/classNames";

export const PlayerDetails: FC<{ self: IPlayer }> = ({ self }) => {
  const { name, owner } = self;
  return (
    <div className={styles.PlayerDetails}>
      <div>
        <PlayerAvatar player={self} className={styles.Avatar} />
      </div>
      <Ribbon className={classNames(styles.Ribbon, owner && styles.owner)}>
        <span>{name}</span>
      </Ribbon>
    </div>
  );
};
