import styles from "./Button.module.css";
import { FC, ReactNode } from "react";
import { classNames } from "../../utils/classNames";

export const Button: FC<
  {
    disabled?: boolean;
    children?: ReactNode;
    className?: string;
    style?: "primary" | "secondary" | "info" | "danger" | "custom";
    onClick?: () => void;
  } & { [key: `data-${string}`]: string | boolean | number | undefined }
> = ({
  className,
  children,
  style = "primary",
  disabled,
  onClick,
  ...rest
}) => {
  return (
    <button
      className={classNames(className, styles.Button)}
      disabled={disabled}
      onClick={onClick}
      data-style={style}
      {...rest}
    >
      {children}
    </button>
  );
};
