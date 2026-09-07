import styles from "./Game.module.css";

import { FC, useCallback, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { PlayerDetails } from "../components/PlayerDetails/PlayerDetails";
import { TInteractivityProps } from "../components/Board/types";
import {
  ECellStatus,
  TBoard,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { AvailableShips } from "../components/AvailableShips/AvailableShips";
import { BoardGrid } from "../components/Board/BoardGrid";
import { useImmer } from "use-immer";
import { getCell, isValidPlacement, placeShip } from "@repo/game-logic";

export const GamePlacement: FC = () => {
  const { gameState } = useGameStore();

  const [placementBoard, updatePlacementBoard] = useImmer<
    TBoard<ECellStatus | number>
  >(gameState?.myBoard ?? []);

  const myBoard = useMemo((): TBoard<ECellStatus> => {
    console.log("Rebuild myBoard");
    return placementBoard.map((row) =>
      row.map((col) => {
        if (typeof col === "number") {
          return ECellStatus.Ship;
        }
        return col;
      }),
    );
  }, [placementBoard]);

  const [availableShips, setAvailableShips] = useImmer(
    (gameState &&
      gameState.phase === "placement" &&
      (gameState.ships as (TShip & { type: "pending" })[])) ||
      [],
  );

  const [shipSelected, onShipSelected] = useState<TShip | null>(null);
  const placeShipHandler = useCallback(
    async (coords: TCoordinate, modifier?: boolean) => {
      console.log("placeShipHandler", coords);
      const orientation: TShipPlacementOrientation = modifier
        ? "vertical"
        : "horizontal";
      console.log("place_ship", shipSelected, orientation, coords);

      updatePlacementBoard((draft) => {
        if (!shipSelected) return;
        console.log("updatePlacementBoard", JSON.stringify(draft, null, 2));

        const row = draft[coords.y];

        console.log("GET CELL", getCell(draft, coords.x, coords.y));
        const validationResult = isValidPlacement(
          draft,
          coords,
          shipSelected,
          orientation,
        );
        if (validationResult === 1) {
          placeShip(draft, coords, shipSelected, orientation);
          setAvailableShips((draft) => {
            // mark as selected
            const ship = draft.find((needle) => needle.id === shipSelected.id);
            if (ship) {
              ship.placed = true;
            }
          });
          // deselect
          onShipSelected(null);
        } else {
          if (validationResult == -1) {
            console.warn("Cell not empty");
          }
          if (validationResult == -2) {
            console.warn("Not enough space for ship (or out of bounds)");
          }
          if (validationResult == -3) {
            console.warn("Another boat next to it");
          }
        }
        console.log(">", row?.[coords.x], getCell(draft, coords.x, coords.y));
      });
    },
    [setAvailableShips, shipSelected, updatePlacementBoard],
  );
  const placementInteractivity: TInteractivityProps = useMemo(() => {
    if (gameState?.phase === "placement") {
      return {
        isInteractive: true,
        onClick: placeShipHandler,
      };
    }
    return {
      isInteractive: false,
    };
  }, [gameState?.phase, placeShipHandler]);

  return (
    <AppLayout>
      <PlayerDetails
        id={gameState?.self.id ?? ""}
        name={gameState?.self.name ?? ""}
      />

      <section className={styles.Game_layout}>
        <BoardGrid
          board={myBoard}
          heading={"Ustaw statki"}
          {...placementInteractivity}
        />
        {gameState?.phase === "placement" && (
          <AvailableShips
            selected={shipSelected}
            onSelection={onShipSelected}

            ships={availableShips}
          />
        )}
      </section>
    </AppLayout>
  );
};
