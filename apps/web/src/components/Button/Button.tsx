import styles from "./Button.module.css";
import { FC, ReactNode } from "react";
import { classNames } from "../../utils/classNames";

export const Button: FC<{
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  style?: "primary" | "secondary" | "info" | "danger" | "custom";
  onClick?: () => void;
}> = ({ className, children, style = "primary", disabled, onClick }) => {
  return (
    <button
      className={classNames(styles.Button, className)}
      disabled={disabled}
      onClick={onClick}
      data-style={style}
    >
      {children}
    </button>
  );
};
