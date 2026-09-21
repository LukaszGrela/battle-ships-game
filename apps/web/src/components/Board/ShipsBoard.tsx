import { FC } from "react";
import styles from "./ShipsBoard.module.css";
import { classNames } from "../../utils/classNames";
import { BoardGrid } from "./BoardGrid";
import { ShipsLayer } from "../ShipsLayer/ShipsLayer";
import { TBoard, TPlacedShip } from "@repo/types";
import { TInteractivityProps } from "./types";
import { CELL, CELL_MOBILE, GRID_PAD } from "../../utils/ships/constants";
import { useMediaQuery } from "../../utils/screen/useMediaQuery";

export const ShipsBoard: FC<
  {
    owner?: boolean;
    board: TBoard;
    ships: TPlacedShip[];

    className?: string;
  } & TInteractivityProps
> = ({ owner, board, ships, className, ...interactivity }) => {
  const isMobile = useMediaQuery("(max-width: 500px");

  const gridCellSize = isMobile ? CELL_MOBILE : CELL;

  return (
    <div className={classNames(styles.ShipsBoard_board_container, className)}>
      <BoardGrid
        pad={GRID_PAD}
        gridCellSize={gridCellSize}
        className={classNames(
          owner ? styles.ShipsBoard_board_owner : styles.ShipsBoard_board_enemy,
          styles.ShipsBoard_board_game_layer,
        )}

        board={board}
        {...interactivity}
      />
      <ShipsLayer
        className={styles.ShipsBoard_board_ships_layer}
        ships={ships}

        pad={GRID_PAD}
        gridCellSize={gridCellSize}

        rows={board.length ?? 0}
        columns={board.at(0)?.length ?? 0}
      />
    </div>
  );
};
