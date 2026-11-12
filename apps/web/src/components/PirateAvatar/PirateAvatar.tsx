import { IPlayer } from "@repo/types";
import styles from "./PirateAvatar.module.css";
import { FC, useMemo } from "react";
import { seedRandom } from "@repo/game-logic";
import { classNames } from "../../utils/classNames";

export const PirateAvatar: FC<{
  avatarIndex?: number;
  className?: string;
}> = ({ avatarIndex = 1, className }) => {
  return (
    <div
      className={classNames(styles.PirateAvatar, className)}
      data-index={avatarIndex}
      data-wtf
      style={{
        color: "red",
        backgroundImage: `url("/assets/avatars/avatar-${avatarIndex}.png")`,
      }}
    >
      &nbsp;
    </div>
  );
};
const MAX_AVATAR_SPRITES = 3 * 4 * 4;
export const PlayerAvatar: FC<{
  player: Pick<IPlayer, "seed">;
  className?: string;
}> = ({ player, className }) => {
  const avatarIndex = useMemo(() => {
    const random = seedRandom(player.seed);

    const rnd = random.nextInt(1, MAX_AVATAR_SPRITES);

    return rnd;
  }, [player.seed]);

  return <PirateAvatar avatarIndex={avatarIndex} className={className} />;
};
