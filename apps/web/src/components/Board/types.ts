import { TCoordinate, ECellStatus } from "@repo/types";
import { ReactNode } from "react";

export type TInteractiveCell = {
  isInteractive: true;
  onClick: (coords: TCoordinate, modifier?: boolean) => void;
};

export type TStaticCell = {
  isInteractive?: false;
  onClick?: never;
};

export type TInteractivityProps = TInteractiveCell | TStaticCell;

export type TProps = {
  className?: string;
  board: ECellStatus[][];
  heading?: ReactNode;
  disabled?: boolean;
} & TInteractivityProps;

export type TCell = {
  status: ECellStatus;
  coords: TCoordinate;
  disabled?: boolean;
} & TInteractivityProps;
