import { ReactNode } from "react";

type TDataProps = {
  [key: `data-${string}`]: string | boolean | number | undefined;
};

export type TButtonProps = {
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  type?: "primary" | "secondary" | "info" | "danger" | "custom";
  size?: "sm" | "md" | "lg" | "custom";
  onClick?: () => void;
} & TDataProps;
