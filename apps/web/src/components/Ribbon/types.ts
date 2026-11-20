import { CSSProperties, ReactNode } from "react";

export interface IProps {
  children: ReactNode;
  ribbonFoldLeftChildren?: ReactNode;
  ribbonFoldRightChildren?: ReactNode;
  className?: string;
  /**
   * Styl inline na głównym elemencie. Najprostszy sposób nadpisania zmiennych
   * CSS wstążki (`--ribbon-*`) bez generowania klas — np. gdy wartościami
   * steruje JS/Storybook.
   */
  style?: CSSProperties;

  ribbonFoldLeftClassName?: string;
  ribbonFoldRightClassName?: string;
}
