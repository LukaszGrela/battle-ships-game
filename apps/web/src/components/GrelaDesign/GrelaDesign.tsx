import styles from "./GrelaDesign.module.css";
import { FC } from "react";
import { GrelaDesignIcon } from "../icons";
import { classNames } from "../../utils/classNames";

export const GrelaDesign: FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={classNames(styles.GrelaDesign, className)}>
      <GrelaDesignIcon className="GrelaDesign_logo" />
      <span className="GrelaDesign_copy">GrelaDesign (c) 2026</span>{" "}
      <span className="GrelaDesign_info">
        <span className="GrelaDesign_version">{__APP_VERSION__}</span>
        <span className="GrelaDesign_commit">({__APP_COMMIT__})</span>
      </span>
    </div>
  );
};
