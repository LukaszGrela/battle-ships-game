import { IPlayer } from "@repo/types";
import styles from "./PirateAvatar.module.css";
import { CSSProperties, FC, useMemo } from "react";
import { seedRandom } from "@repo/game-logic";
import { classNames } from "../../utils/classNames";

export const PirateAvatar: FC<{
  x?: number;
  y?: number;
  atlas?: number;
  className?: string;
}> = ({ x = 0, y = 0, atlas = 1, className }) => {
  const style = useMemo(() => {
    return {
      "--avatar-x": x,
      "--avatar-y": y,
    } as CSSProperties;
  }, [x, y]);

  return (
    <div
      className={classNames(styles.PirateAvatar, className)}
      data-atlas={atlas}

      style={style}
    >
      &nbsp;
    </div>
  );
};

export const PlayerAvatar: FC<{ player: IPlayer; className?: string }> = ({
  player,
  className,
}) => {
  const params = useMemo(() => {
    const random = seedRandom(player.seed);
    console.log("Seed", player.seed);
    console.log("Random", random);
    return {
      x: random.nextInt(0, 3),
      y: random.nextInt(0, 3),
      atlas: random.nextInt(1, 3),
    };
  }, [player.seed]);

  return <PirateAvatar {...params} className={className} />;
};
