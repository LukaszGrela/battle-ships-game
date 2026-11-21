import styles from "./PlayerDetails.module.css";
import { EGamePhase, IPlayer } from "@repo/types";
import { FC } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import { PlayerAvatar } from "../PirateAvatar/PirateAvatar";
import { classNames } from "../../utils/classNames";

export const PlayerDetails: FC<{
  self: IPlayer;
  enemy?: boolean;
  phase?: EGamePhase;
  className?: string;
  result?: "win" | "lost";
}> = ({ self, enemy, phase, className, result }) => {
  const { name, owner, ready, active, botLevel } = self;

  return (
    <div
      className={classNames(styles.PlayerDetails, className)}
      data-enemy={enemy ? "" : undefined}
      data-enemy-ready={enemy && ready && active ? "" : undefined}
      data-enemy-inactive={!active && ready ? "" : undefined}
    >
      <Ribbon className={classNames(styles.Ribbon, owner && styles.owner)}>
        <AvatarContainer
          className="avatar-middle"
          player={self}
          botLevel={botLevel}
        />
        <span>{name}</span>
        {result === "win" && (
          <img
            alt="Golden Anchor Trophy"
            src="/assets/gold-anchor-64.png"
            className={styles.winnerPin}
          />
        )}
        {result === "win" && (
          <span className={styles.winnerTitle}>Winner!</span>
        )}
        {enemy && ready && phase === EGamePhase.Placement && (
          <span className={styles.playerReady}>Player Ready!</span>
        )}
        {enemy &&
          !active &&
          (phase === EGamePhase.Playing || phase === EGamePhase.Finished) && (
            <span className={styles.playerReady}>Player left the game!</span>
          )}
      </Ribbon>
    </div>
  );
};

const AvatarContainer: FC<{
  className?: string;
  player: IPlayer;
  botLevel?: string;
}> = ({ className, player, botLevel }) => {
  const enemyIsBot = !!botLevel;

  return (
    <div className={classNames(styles.Avatar, className)}>
      <PlayerAvatar player={player} className={styles.Avatar_img} />

      {enemyIsBot && (
        <span
          className={styles.Avatar_botLevel}
        >{`Bot level: ${botLevel}`}</span>
      )}
    </div>
  );
};
