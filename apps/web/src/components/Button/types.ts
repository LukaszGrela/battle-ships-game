import { TDataProps } from "@repo/types";
import { ReactNode } from "react";

export type TButtonProps = {
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  type?: "primary" | "secondary" | "info" | "danger" | "custom";
  size?: "sm" | "md" | "lg" | "custom";
  onClick?: () => void;
} & TDataProps;
