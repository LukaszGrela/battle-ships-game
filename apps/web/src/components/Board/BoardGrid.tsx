import styles from "./BoardGrid.module.css";
import { FC } from "react";
import { classNames } from "../../utils/classNames";
import { TProps } from "./types";
import { BoardGridContainer } from "./BoardGridContainer";
import { Grid } from "./Grid";

export const BoardGrid: FC<TProps> = ({
  board,
  className,
  heading,
  ...interactiveProps
}) => {
  console.log("BoardGrid", board);
  console.log("BoardGrid.interactiveProps", interactiveProps);
  return (
    <BoardGridContainer
      rows={board.length ?? 0}
      columns={board.at(0)?.length ?? 0}
      className={classNames(styles.BoardGrid, className)}
      heading={heading}
    >
      <Grid board={board} {...interactiveProps} />
    </BoardGridContainer>
  );
};
