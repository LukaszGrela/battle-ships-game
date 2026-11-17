import styles from "./PirateAvatar.module.css";
import { FC, ReactNode, useMemo } from "react";
import { IPlayer } from "@repo/types";
import { seedRandom } from "@repo/game-logic";
import { classNames } from "../../utils/classNames";

export const PirateAvatar: FC<{
  isBot?: boolean;
  avatarIndex?: number;
  className?: string;
  children?: ReactNode;
}> = ({ avatarIndex = 1, className, isBot, children }) => {
  return (
    <div
      className={classNames(styles.PirateAvatar, className)}
      data-index={avatarIndex}
      style={{
        backgroundImage: `url("/assets/avatars/${isBot ? "bot/" : ""}avatar-${avatarIndex}.png")`,
      }}
    >
      {children || <>&nbsp;</>}
    </div>
  );
};
const MAX_AVATAR_SPRITES = 3 * 4 * 4;
export const PlayerAvatar: FC<{
  player: Pick<IPlayer, "seed" | "botLevel">;
  className?: string;
  children?: ReactNode;
}> = ({ player, className, children }) => {
  const avatarIndex = useMemo(() => {
    const random = seedRandom(player.seed);

    const rnd = random.nextInt(1, MAX_AVATAR_SPRITES);

    return rnd;
  }, [player.seed]);

  return (
    <PirateAvatar
      isBot={!!player.botLevel}
      avatarIndex={avatarIndex}
      className={className}
    >
      {children}
    </PirateAvatar>
  );
};
