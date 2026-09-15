import styles from "./Game.module.css";

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Draft } from "immer";
import { useImmer } from "use-immer";
import { AppLayout } from "../components/AppLayout/AppLayout";
import { useGameStore } from "../store/useGameStore";
import { PlayerDetails } from "../components/PlayerDetails/PlayerDetails";
import {
  ECellStatus,
  IPlayer,
  TBoard,
  TCoordinate,
  TPlacedShip,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { AvailableShips } from "../components/AvailableShips/AvailableShips";
import { TInteractivityProps } from "../components/Board";
import {
  getCell,
  isValidPlacement,
  placeShip,
  removeShip,
} from "@repo/game-logic";
import { socket } from "../socket";
import { ShipsBoard } from "../components/Board/ShipsBoard";

const useSocketPlayerReady = () => {
  useEffect(() => {
    const playerReadyCallback = (
      playerName: Pick<IPlayer, "name" | "seed" | "owner">,
    ) => {
      console.log(`Player ${playerName.name} is ready!`);
    };
    socket.on("player_ready", playerReadyCallback);

    return () => {
      socket.off("player_ready", playerReadyCallback);
    };
  }, []);
};

export const GamePlacement: FC = () => {
  const { gameState } = useGameStore();

  useSocketPlayerReady();

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
    (gameState && gameState.phase === "placement" && gameState.ships) || [],
  );

  const [shipSelected, onShipSelected] = useState<TShip | null>(null);

  const rotateShipUnderPointer = useCallback(
    (
      cell: number | ECellStatus,
      placementBoardDraft: Draft<TBoard<number | ECellStatus>>,
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
      }
    },
    [availableShips, setAvailableShips],
  );

  const placeShipHandler = useCallback(
    async (coords: TCoordinate, modifier?: boolean) => {
      console.log("placeShipHandler", coords);
      const orientation: TShipPlacementOrientation = modifier
        ? "vertical"
        : "horizontal";
      console.log("place_ship", shipSelected, orientation, coords);

      updatePlacementBoard((draft) => {
        if (!shipSelected) {
          // whats under the pointer?

          const cell = getCell(draft, coords.x, coords.y);
          if (cell != ECellStatus.Empty) {
            rotateShipUnderPointer(cell, draft, coords);
          }
          return;
        }
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
            if (ship && ship.type === "pending") {
              ship.placed = true;
              ship.coords = coords;
              ship.orientation = orientation;
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

  return (
    <AppLayout>
      <PlayerDetails
        id={gameState?.self.id ?? ""}
        name={gameState?.self.name ?? ""}
      />

      <section className={styles.Game_layout}>
        <div>
          <h2>Ustaw statki</h2>
          <ShipsBoard
            board={myBoard}
            owner={!!gameState?.self.owner}

            ships={availableShips as TPlacedShip[]}

            {...placementInteractivity}
          />
        </div>
        {gameState?.phase === "placement" && (
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
