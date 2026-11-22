import styles from "./PlayerDetails.module.css";
import { EGamePhase, IPlayer } from "@repo/types";
import { FC } from "react";
import { Ribbon } from "../Ribbon/Ribbon";
import { PlayerAvatar } from "../PirateAvatar/PirateAvatar";
import { classNames } from "../../utils/classNames";
import { useMediaQuery } from "../../utils/screen/useMediaQuery";

export const PlayerDetails: FC<{
  self: IPlayer;
  enemy?: boolean;
  phase?: EGamePhase;
  className?: string;
  result?: "win" | "lost";
  battleResults?: number;
}> = ({ self, enemy, phase, className, result, battleResults }) => {
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
        <BattleResults
          count={battleResults}
          className={styles.battleResults}
          current={result === "win"}
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

const BattleResults: FC<{
  count?: number;
  className?: string;
  // if true then current battle is also won, increase label counter by 1 (results + battleResults)
  current?: boolean;
}> = ({ className, count, current }) => {
  const isMobile = useMediaQuery("(max-width: 720px)");

  const maxSize = isMobile ? 1 : 4;
  const trophies = Math.min(maxSize, count ?? 0);

  const tail = isMobile ? `x${count}` : `+${(count ?? 0) - maxSize}`;

  return (
    !!count &&
    count > 0 && (
      <div
        className={className}
        aria-live="polite"
        aria-label={`${count + (current ? 1 : 0)} battles won.`}
        role="img"
      >
        <ul>
          {Array.from({ length: trophies }).map((_, index) => {
            return (
              <img
                key={index}
                alt="Battle won trophy"
                src="/assets/gold-anchor-64.png"
              />
            );
          })}
        </ul>
        {count > maxSize && <span className="BattleResults_tail">{tail}</span>}
      </div>
    )
  );
};
