import { ReactNode } from "react";

type TDataProps = {
  [key: `data-${string}`]: string | boolean | number | undefined;
};

export type TButtonProps = {
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  type?: "primary" | "secondary" | "info" | "danger" | "custom";
  onClick?: () => void;
} & TDataProps;
