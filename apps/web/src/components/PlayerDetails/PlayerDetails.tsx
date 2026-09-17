import styles from "./PlayerDetails.module.css";
import { EGamePhase, IPlayer } from "@repo/types";
import { FC } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import { PlayerAvatar } from "../PirateAvatar/PirateAvatar";
import { classNames } from "../../utils/classNames";

export const PlayerDetails: FC<{
  self: IPlayer;
  enemy?: boolean;
  phase: EGamePhase;
}> = ({ self, enemy, phase }) => {
  const { name, owner, ready } = self;
  return (
    <div
      className={styles.PlayerDetails}
      data-enemy={enemy ? "" : undefined}
      data-enemy-ready={enemy && ready ? "" : undefined}
    >
      <div className={styles.Avatar}>
        <PlayerAvatar player={self} />
      </div>
      <Ribbon className={classNames(styles.Ribbon, owner && styles.owner)}>
        <span>{name}</span>
      </Ribbon>
      {enemy && ready && phase === EGamePhase.Placement && (
        <span className={styles.playerReady}>Player Ready!</span>
      )}
    </div>
  );
};
