import gameStyles from "./Game.module.css";
import styles from "./GamePlacement.module.css";

import { FC, useCallback, useEffect, useMemo, useState } from "react";
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
  autoPlaceShips,
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
import { classNames } from "../utils/classNames";
import { GrelaDesign } from "../components/GrelaDesign/GrelaDesign";

const empty: TCellStatusEmpty = -1;

export const GamePlacement: FC = () => {
  const { gameState } = useGameStore();

  const [displayError, error, setError] = useError();

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
              // restore orientation

              const newState =
                newOrientation === "horizontal" ? "vertical" : "horizontal";
              setOrientationChange(newState);

              if (validationResult == -1001) {
                setError("Cell not empty");
              }
              if (validationResult == -1002) {
                setError("Not enough space for ship (or out of bounds)");
              }
              if (validationResult == -1003) {
                setError("Another boat next to it");
              }
            }
          }
        }
      });
    },
    [
      availableShips,
      selectedShipId,
      setAvailableShips,
      setError,
      updatePlacementBoard,
    ],
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
        if (selection) {
          if (selection.placed) {
            setOrientationChange(selection.orientation);
          }
          setAvailableShips((draftShips) => {
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
                setError("Cell not empty");
              }
              if (validationResult == -1002) {
                setError("Not enough space for ship (or out of bounds)");
              }
              if (validationResult == -1003) {
                setError("Another boat next to it");
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
      setError,
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
    // reset error
    setError(undefined);
  }, [gameState, setAvailableShips, setError, updatePlacementBoard]);

  const handleAutoPlacement = useCallback(() => {
    let ships = availableShips as (TShip & { type: "pending" })[];
    const someNotPlaced = ships.some(
      (needle) => needle.type === "pending" && !needle.placed,
    );
    console.log("handleAutoPlacement", availableShips);
    console.log("handleAutoPlacement", someNotPlaced);
    let board = placementBoard;
    if (!someNotPlaced) {
      // reset first
      ships =
        (gameState &&
          gameState.phase === "placement" &&
          (gameState.ships as (TShip & { type: "pending" })[])) ||
        [];

      // reset ships
      setAvailableShips(ships);
      // reset board
      board = gameState?.myBoard ?? [];
      updatePlacementBoard(board);
    }
    const result = autoPlaceShips(board, ships);

    if (!result) {
      setError("Auto placement failed. Reset the board and try again.");
      return;
    }

    updatePlacementBoard(() => result.board);
    setAvailableShips(() => result.ships);
    setSelectedShipId(null);
    setError(undefined);
  }, [
    availableShips,
    gameState,
    placementBoard,
    setAvailableShips,
    setError,
    updatePlacementBoard,
  ]);

  const handleApplyPlacement = useCallback(() => {
    // deselect all
    setAvailableShips((draftShips) => {
      // deselect
      draftShips.forEach((ship) => {
        if (ship && ship.type === "pending" && ship.placed && ship.selected) {
          ship.selected = false;
        }
      });
    });

    // emit placement
    socket.emit(
      "place_ships",
      availableShips as (TShip & { type: "pending" })[],
    );
  }, [availableShips, setAvailableShips]);

  const toggleOrientation = useCallback(() => {
    const newState = orientation === "horizontal" ? "vertical" : "horizontal";
    setOrientationChange(newState);
    changeShipOrientation(newState);
  }, [changeShipOrientation, orientation]);

  const disableApply =
    availableShips.some(
      (needle) => needle.type === "pending" && !needle.placed,
    ) || !!gameState?.self.ready;
  const disableReset =
    !availableShips.some(
      (needle) => needle.type === "pending" && needle.placed,
    ) || !!gameState?.self.ready;

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
        <div className={styles.ShipBoard_container}>
          <ShipsBoard
            board={placementBoard}
            owner={!!gameState?.self.owner}

            ships={availableShips as TPlacedShip[]}

            {...placementInteractivity}
          />
          <ErrorPanel show={displayError} message={error} />
        </div>
        {gameState?.phase === "placement" && !gameState?.self.ready && (
          <AvailableShips
            selected={selectedShipId}
            onSelection={handleShipSelection}

            ships={availableShips as (TShip & { type: "pending" })[]}

            disabled={gameState.self.ready}
          >
            <Button
              size="sm"
              disabled={gameState.self.ready || selectedShipId == null}
              onClick={toggleOrientation}
            >
              Orientation: {orientation}
            </Button>
            <div className={styles.Actions}>
              <Button
                type="secondary"
                onClick={handleResetPlacement}
                disabled={disableReset}
              >
                Reset
              </Button>
              <Button
                type="secondary"
                onClick={handleAutoPlacement}
                disabled={gameState.self.ready}
              >
                Auto placement
              </Button>
              <Button onClick={handleApplyPlacement} disabled={disableApply}>
                Ready
              </Button>
            </div>
          </AvailableShips>
        )}
        <GrelaDesign className={gameStyles.footerLogo} />
      </section>
    </AppLayout>
  );
};

const useError = (): [
  show: boolean,
  error: string | undefined,
  setter: (message?: string) => void,
] => {
  const [error, setError] = useState<string | undefined>("");
  const [show, setShow] = useState<boolean>(false);

  const setter = useCallback((message?: string) => {
    setError(message);
    if (message) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setShow(false);
    }, 2000);

    return () => {
      clearTimeout(id);
    };
  }, [error, show]);

  return useMemo(() => [show, error, setter], [show, error, setter]);
};

const ErrorPanel: FC<{ show: boolean; message?: string }> = ({
  show,
  message,
}) => {
  return (
    <div
      className={classNames(
        styles.ErrorPanel,
        !show && styles.ErrorPanel_hidden,
      )}
    >
      <h3>Error</h3>
      <p>{message}</p>
    </div>
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
      return { ...ship, orientation: "horizontal" } as TShip;
    }
  }

  return ship;
};
*/
