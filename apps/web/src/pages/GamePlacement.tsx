import gameStyles from "./Game.module.css";
import styles from "./GamePlacement.module.css";

import { FC, useCallback, useMemo, useState } from "react";
import { useImmer } from "use-immer";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import {
  TBoard,
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
import { Button } from "../components/Button";

const empty: TCellStatusEmpty = -1;

export const GamePlacement: FC = () => {
  const { gameState } = useGameStore();

  const [placementBoard, updatePlacementBoard] = useImmer<TBoard>(
    gameState?.myBoard ?? [],
  );

  const [availableShips, setAvailableShips] = useImmer(
    (gameState && gameState.phase === "placement" && gameState.ships) || [],
  );

  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [orientation, setOrientationChange] =
    useState<TShipPlacementOrientation>("horizontal");

  const changeShipOrientation = useCallback(
    (newOrientation: TShipPlacementOrientation) => {
      function findShip(id: number) {
        return availableShips.find((needle) => needle.id === id);
      }

      updatePlacementBoard((draft) => {
        if (selectedShipId) {
          const selection = findShip(selectedShipId) as
            | (TShip & {
                type: "pending";
              })
            | undefined;
          if (!selection) return;

          if (selection.placed) {
            // can only change orientation of a selected and placed ship
            // first remove ship
            removeShip(
              draft,
              selection.coords,
              selection,
              selection.orientation,
            );

            // validate new location
            const validationResult = isValidPlacement(
              draft,
              selection.coords,
              selection,
              // new orientation
              newOrientation,
            );
            if (validationResult === 1) {
              // apply new orientation
              placeShip(draft, selection.coords, selection, newOrientation);
              setAvailableShips((draftShips) => {
                // mark as selected
                const ship = draftShips.find(
                  (needle) => needle.id === selection.id,
                );
                if (ship && ship.type === "pending") {
                  ship.placed = true;
                  ship.coords = selection.coords;
                  ship.orientation = newOrientation;
                }
              });
            } else {
              // restore previous location
              placeShip(
                draft,
                selection.coords,
                selection,
                selection.orientation,
              );

              if (validationResult == -1001) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Cell not empty");
              }
              if (validationResult == -1002) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Not enough space for ship (or out of bounds)");
              }
              if (validationResult == -1003) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Another boat next to it");
              }
            }
          }
        }
      });
    },
    [availableShips, selectedShipId, setAvailableShips, updatePlacementBoard],
  );
  const handleShipSelection = useCallback(
    (shipId: number | null) => {
      if (shipId != null) {
        setSelectedShipId(shipId);
        function findShip(id: number) {
          return availableShips.find((needle) => needle.id === id);
        }
        const selection = findShip(shipId) as
          | (TShip & {
              type: "pending";
            })
          | undefined;
        if (selection && selection.placed) {
          setOrientationChange(selection.orientation);
          setAvailableShips((draftShips) => {
            // mark as selected
            const selected = draftShips.find(
              (needle) =>
                needle &&
                needle.type === "pending" &&
                needle.placed &&
                needle.selected,
            );

            if (selected?.type === "pending" && selected.placed) {
              // deselect any previous selections
              selected.selected = false;
            }

            // select
            const ship = draftShips.find(
              (needle) =>
                needle &&
                needle.type === "pending" &&
                needle.placed &&
                needle.id === shipId,
            ) as
              | (TShip & {
                  type: "pending";
                })
              | undefined;

            if (ship && ship.placed) {
              ship.selected = true;
            }
          });
        }
      } else {
        setSelectedShipId(null);
        setAvailableShips((draftShips) => {
          // deselect
          const ship = draftShips.find(
            (needle) =>
              needle &&
              needle.type === "pending" &&
              needle.placed &&
              needle.selected,
          ) as
            | (TShip & {
                type: "pending";
              })
            | undefined;

          if (ship && ship.placed) {
            ship.selected = false;
          }
        });
      }
    },
    [availableShips, setAvailableShips],
  );

  const placeShipHandler = useCallback(
    async (coords: TCoordinate) => {
      function findShip(id: number) {
        return availableShips.find((needle) => needle.id === id);
      }
      updatePlacementBoard((draft) => {
        const cell = getCell(draft, coords.x, coords.y);
        if (cell && !isCellFailure(cell)) {
          if (cell != empty) {
            // get ship
            const ship = findShip(cell);
            if (ship) {
              // reselect ship
              handleShipSelection(ship.id);
              //
              return;
            }
          }
          if (selectedShipId) {
            const selection = findShip(selectedShipId) as
              | (TShip & {
                  type: "pending";
                })
              | undefined;
            if (!selection) return;

            if (selection.placed) {
              // first remove ship
              removeShip(
                draft,
                selection.coords,
                selection,
                selection.orientation,
              );
            }

            // validate new location
            const validationResult = isValidPlacement(
              draft,
              coords,
              selection,
              orientation,
            );

            if (validationResult === 1) {
              placeShip(draft, coords, selection, orientation);
              setAvailableShips((draftShips) => {
                // mark as selected
                const selected = draftShips.find(
                  (needle) =>
                    needle &&
                    needle.type === "pending" &&
                    needle.placed &&
                    needle.selected,
                );
                if (selected?.type === "pending" && selected.placed) {
                  // deselect any previous selections
                  selected.selected = false;
                }
                const ship = draftShips.find(
                  (needle) => needle.id === selection.id,
                );
                if (ship && ship.type === "pending") {
                  ship.placed = true;
                  ship.coords = coords;
                  ship.orientation = orientation;
                  if (ship.placed) {
                    ship.selected = true;
                  }
                }
              });
            } else {
              if (selection.placed) {
                // restore previous location
                placeShip(
                  draft,
                  selection.coords,
                  selection,
                  selection.orientation,
                );
              }
              if (validationResult == -1001) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Cell not empty");
              }
              if (validationResult == -1002) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Not enough space for ship (or out of bounds)");
              }
              if (validationResult == -1003) {
                // TODO: Add Toast/Alert ton inform user of invalid placement
                console.warn("Another boat next to it");
              }
            }
          }
        }
      });
    },
    [
      updatePlacementBoard,
      availableShips,
      selectedShipId,
      handleShipSelection,
      orientation,
      setAvailableShips,
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
    // reset selection
    setSelectedShipId(null);
    setOrientationChange("horizontal");
  }, [gameState, setAvailableShips, updatePlacementBoard]);

  const handleApplyPlacement = useCallback(() => {
    // save placement

    socket.emit(
      "place_ships",
      availableShips as (TShip & { type: "pending" })[],
    );
  }, [availableShips]);

  const toggleOrientation = useCallback(() => {
    const newState = orientation === "horizontal" ? "vertical" : "horizontal";
    setOrientationChange(newState);
    changeShipOrientation(newState);
  }, [changeShipOrientation, orientation]);

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
            selected={selectedShipId}
            onSelection={handleShipSelection}

            ships={availableShips as (TShip & { type: "pending" })[]}

            onApply={handleApplyPlacement}
            onReset={handleResetPlacement}

            disabled={gameState.self.ready}
          >
            <Button
              size="sm"
              disabled={gameState.self.ready || selectedShipId == null}
              onClick={toggleOrientation}
            >
              Orientation: {orientation}
            </Button>
          </AvailableShips>
        )}
      </section>
    </AppLayout>
  );
};

// TODO: to consider later
/*
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
*/
