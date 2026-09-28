import { IPlayer } from "@repo/types";
import styles from "./PirateAvatar.module.css";
import { CSSProperties, FC, useMemo } from "react";
import { seedRandom } from "@repo/game-logic";
import { classNames } from "../../utils/classNames";
import { mapIndexToAtlas } from "./utils";

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
const ALL_ATLASES_SPRITES = 3 * 4 * 4;
export const PlayerAvatar: FC<{
  player: Pick<IPlayer, "seed">;
  className?: string;
}> = ({ player, className }) => {
  const params = useMemo(() => {
    const random = seedRandom(player.seed);

    const rnd = random.nextInt(0, ALL_ATLASES_SPRITES - 1);

    return mapIndexToAtlas(rnd);
  }, [player.seed]);

  return <PirateAvatar {...params} className={className} />;
};
