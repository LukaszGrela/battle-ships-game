import { classNames } from "../../utils/classNames";
import styles from "./Waves.module.css";
import { FC } from "react";

export const Waves: FC<{
  className?: string;
  direction?: "left" | "right";
}> = ({ className, direction }) => {
  return (
    <div
      className={classNames(styles.Waves, className)}
      data-direction={direction}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 360 18"
        preserveAspectRatio="none"
        className={styles.Waves_svg}
        aria-hidden="true"
        strokeLinecap="round"
      >
        {/*
          One continuous path, starting exactly at x = 0.
          4 segments × 120 units = 480 units of content,
          covering the 360-unit viewBox PLUS one spare period
          (the extra 120 units hang off the right edge and are
          clipped away by the SVG viewport).
        */}
        <path
          className={styles.Waves_path}
          d="M0 12
             Q15 4 30 12
             T60 12 T90 12 T120 12
             T150 12 T180 12 T210 12 T240 12
             T270 12 T300 12 T330 12 T360 12
             T390 12 T420 12 T450 12 T480 12"
          fill="none"
        />
      </svg>
    </div>
  );
};
