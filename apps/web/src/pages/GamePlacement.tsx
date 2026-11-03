import gameStyles from "./Game.module.css";
import styles from "./GamePlacement.module.css";

import { FC, useCallback, useMemo, useState } from "react";
import { Draft } from "immer";
import { useImmer } from "use-immer";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import {
  TBoard,
  TCellStatus,
  TCellStatusEmpty,
  TCoordinate,
  TPlacedShip,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { AvailableShips } from "../components/AvailableShips/AvailableShips";
import { TInteractivityProps } from "../components/Board";
import {
  getCell,
  isCellFailure,
  isValidPlacement,
  placeShip,
  removeShip,
} from "@repo/game-logic";
import { socket } from "../socket";
import { ShipsBoard } from "../components/Board/ShipsBoard";
import {
  GameHeader,
  TGameHeaderAllowedState,
} from "../components/GameHeader/GameHeader";

const empty: TCellStatusEmpty = -1;

export const GamePlacement: FC = () => {
  const { gameState } = useGameStore();

  const [placementBoard, updatePlacementBoard] = useImmer<TBoard>(
    gameState?.myBoard ?? [],
  );

  const [availableShips, setAvailableShips] = useImmer(
    (gameState && gameState.phase === "placement" && gameState.ships) || [],
  );

  const [shipSelected, onShipSelected] = useState<TShip | null>(null);

  const rotateShipUnderPointer = useCallback(
    (
      cell: TCellStatus,
      placementBoardDraft: Draft<TBoard>,
      // TODO: to implement rotate around point
      _coords: TCoordinate,
    ) => {
      // get ship
      const ship = availableShips.find((needle) => needle.id === cell);
      if (ship && ship.orientation && ship.coords) {
        const orientation: TShipPlacementOrientation =
          ship.orientation === "horizontal" ? "vertical" : "horizontal";

        // remove from placement board
        removeShip(placementBoardDraft, ship.coords, ship, ship.orientation);

        // check if rotation is possible
        const validationResult = isValidPlacement(
          placementBoardDraft,
          ship.coords,
          ship,
          orientation,
        );
        // place with opposite orientation
        if (validationResult === 1) {
          placeShip(placementBoardDraft, ship.coords, ship, orientation);
          setAvailableShips((draft) => {
            // mark as selected
            const toUpdate = draft.find((needle) => needle.id === ship.id);
            if (toUpdate && toUpdate.type === "pending") {
              toUpdate.orientation = orientation;
            }
          });
        } else {
          // restore original
          placeShip(placementBoardDraft, ship.coords, ship, ship.orientation!);

          if (validationResult == -1001) {
            console.warn("Cell not empty");
          }
          if (validationResult == -1002) {
            console.warn("Not enough space for ship (or out of bounds)");
          }
          if (validationResult == -1003) {
            console.warn("Another boat next to it");
          }
        }
      }
    },
    [availableShips, setAvailableShips],
  );

  const placeShipHandler = useCallback(
    async (coords: TCoordinate, modifier?: boolean) => {
      console.log("placeShipHandler", coords);
      let orientation: TShipPlacementOrientation =
        shipSelected?.orientation ?? "horizontal";

      if (modifier) {
        // flip
        orientation = orientation === "horizontal" ? "vertical" : "horizontal";
      }
      console.log("place_ship", shipSelected, orientation, coords);

      updatePlacementBoard((draft) => {
        if (!shipSelected) {
          // whats under the pointer?

          const cell = getCell(draft, coords.x, coords.y);

          if (!isCellFailure(cell) && cell != empty) {
            rotateShipUnderPointer(cell, draft, coords);
          }
          return;
        }
        let shipToPlace = { ...shipSelected, orientation } as TShip;
        console.log("updatePlacementBoard", shipToPlace);

        const row = draft[coords.y];

        console.log("GET CELL", getCell(draft, coords.x, coords.y));
        shipToPlace = handleEdgePlacement(coords, shipToPlace, draft);

        const validationResult = isValidPlacement(
          draft,
          coords,
          shipToPlace,
          shipToPlace.orientation!,
        );
        console.log("validationResult", validationResult);
        if (validationResult === 1) {
          placeShip(draft, coords, shipToPlace, shipToPlace.orientation!);
          setAvailableShips((draftShips) => {
            // mark as selected
            const ship = draftShips.find(
              (needle) => needle.id === shipToPlace.id,
            );
            if (ship && ship.type === "pending") {
              ship.placed = true;
              ship.coords = coords;
              ship.orientation = shipToPlace.orientation!;
            }
          });
          // deselect
          onShipSelected(null);
        } else {
          if (validationResult == -1001) {
            console.warn("Cell not empty");
          }
          if (validationResult == -1002) {
            console.warn("Not enough space for ship (or out of bounds)");
          }
          if (validationResult == -1003) {
            console.warn("Another boat next to it");
          }
        }
        console.log(">", row?.[coords.x], getCell(draft, coords.x, coords.y));
      });
    },
    [
      rotateShipUnderPointer,
      setAvailableShips,
      shipSelected,
      updatePlacementBoard,
    ],
  );
  const placementInteractivity: TInteractivityProps = useMemo(() => {
    if (gameState?.phase === "placement" && !gameState.self.ready) {
      return {
        isInteractive: true,
        onClick: placeShipHandler,
      };
    }
    return {
      isInteractive: false,
    };
  }, [gameState?.phase, gameState?.self.ready, placeShipHandler]);

  const handleResetPlacement = useCallback(() => {
    // reset ships
    setAvailableShips(
      (gameState &&
        gameState.phase === "placement" &&
        (gameState.ships as (TShip & { type: "pending" })[])) ||
        [],
    );
    // reset board
    updatePlacementBoard(gameState?.myBoard ?? []);
  }, [gameState, setAvailableShips, updatePlacementBoard]);

  const handleApplyPlacement = useCallback(() => {
    // save placement

    socket.emit(
      "place_ships",
      availableShips as (TShip & { type: "pending" })[],
    );
  }, [availableShips]);

  console.log("availableShips", availableShips);
  console.log(gameState);

  return (
    <AppLayout
      headerClassName={styles.Header}
      header={
        <>
          {gameState && (
            <GameHeader
              gameState={gameState as TGameHeaderAllowedState}
              showAbandon
            />
          )}
          {!gameState?.self.ready && <h2>Place your ships</h2>}
          {gameState?.self.ready && <h2>Waiting for opponent</h2>}
        </>
      }
    >
      <section className={gameStyles.Game_layout}>
        <div>
          <ShipsBoard
            board={placementBoard}
            owner={!!gameState?.self.owner}

            ships={availableShips as TPlacedShip[]}

            {...placementInteractivity}
          />
        </div>
        {gameState?.phase === "placement" && !gameState?.self.ready && (
          <AvailableShips
            selected={shipSelected}
            onSelection={onShipSelected}

            ships={availableShips as (TShip & { type: "pending" })[]}

            onApply={handleApplyPlacement}
            onReset={handleResetPlacement}

            disabled={gameState.self.ready}
          />
        )}
      </section>
    </AppLayout>
  );
};

const handleEdgePlacement = <T,>(
  coords: TCoordinate,
  ship: TShip,
  board: TBoard<T>,
): TShip => {
  if (ship.orientation === "horizontal") {
    if (
      coords.x === board.at(0)!.length - 1 &&
      coords.y + ship.size <= board.length
    ) {
      return { ...ship, orientation: "vertical" } as TShip;
    }
  } else {
    if (
      coords.y === board.length - 1 &&
      coords.x + ship.size <= board.at(0)!.length
    ) {
      console.log("Ship is at the bottom edge of the board");
      return { ...ship, orientation: "horizontal" } as TShip;
    }
  }

  return ship;
};
