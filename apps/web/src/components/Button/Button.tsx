import styles from "./Button.module.css";
import { FC } from "react";
import { classNames } from "../../utils/classNames";
import { TButtonProps } from "./types";

export const Button: FC<TButtonProps> = ({
  className,
  children,
  type = "primary",
  disabled,
  onClick,
  size = "md",
  ...rest
}) => {
  return (
    <button
      className={classNames(className, styles.Button)}
      disabled={disabled}
      onClick={onClick}
      data-type={type}
      data-size={size}
      {...rest}
    >
      {children}
    </button>
  );
};
