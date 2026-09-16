import { FC } from "react";
import styles from "./ShipsBoard.module.css";
import { classNames } from "../../utils/classNames";
import { BoardGrid } from "./BoardGrid";
import { ShipsLayer } from "../ShipsLayer/ShipsLayer";
import { TBoard, TPlacedShip } from "@repo/types";
import { TInteractivityProps } from "./types";
import { CELL, GRID_PAD } from "../../utils/ships/constants";

export const ShipsBoard: FC<
  {
    owner?: boolean;
    board: TBoard;
    ships: TPlacedShip[];
  } & TInteractivityProps
> = ({ owner, board, ships, ...interactivity }) => {
  return (
    <div className={styles.ShipsBoard_board_container}>
      <BoardGrid
        pad={GRID_PAD}
        gridCellSize={CELL}
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
        gridCellSize={CELL}

        rows={board.length ?? 0}
        columns={board.at(0)?.length ?? 0}
      />
    </div>
  );
};
