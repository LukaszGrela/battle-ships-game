import { TCoordinate, ECellStatus } from "@repo/types";

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
  disabled?: boolean;
  /**
   * Number of row/columns to pad around the grid
   */
  pad?: number;
  /**
   * Size of the grid cell in pixels
   */
  gridCellSize?: number;
} & TInteractivityProps;

export type TCell = {
  status: ECellStatus;
  coords: TCoordinate;
  disabled?: boolean;

  lastColumn?: string | boolean;
  lastRow?: string | boolean;
  firstColumn?: string | boolean;
  firstRow?: string | boolean;

  explosionIndex?: number;
} & TInteractivityProps;
