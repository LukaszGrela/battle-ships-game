import {
  TBoard,
  TCellStatus,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { isValidPlacement } from "./isValidPlacement";
import { placeShip, removeShip } from "./placeShip";

type TPendingShip = TShip & { type: "pending" };

export type TPlacementCandidate = {
  coords: TCoordinate;
  orientation: TShipPlacementOrientation;
};

export type TAutoPlacementResult = {
  board: TBoard;
  ships: TPendingShip[];
};

const orientations: TShipPlacementOrientation[] = ["horizontal", "vertical"];

const MAX_ATTEMPTS = 100_000;

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [
      result[swapIndex] as T,
      result[index] as T,
    ];
  }
  return result;
};

const getCandidates = (
  board: TBoard,
  ship: TShip,
  size: number,
  random: () => number,
): TPlacementCandidate[] => {
  const candidates: TPlacementCandidate[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const orientation of orientations) {
        const coords = { x, y };
        if (isValidPlacement(board, coords, ship, orientation, size) === 1) {
          candidates.push({ coords, orientation });
        }
      }
    }
  }

  return shuffle(candidates, random);
};

/**
 * Places every pending, unplaced ship on the board using randomised
 * backtracking. Ships that are already placed are kept in their current
 * position and the function never mutates the passed board.
 *
 * Returns `null` when there is no valid arrangement for the remaining ships.
 */
export const autoPlaceShips = (
  board: TBoard<TCellStatus>,
  ships: TPendingShip[],
  random: () => number = Math.random,
  size = 10,
): TAutoPlacementResult | null => {
  const workingBoard = board.map((row) => [...row]) as TBoard<TCellStatus>;
  const unplacedShips = ships.filter((ship) => !ship.placed);
  const placements = new Map<number, TPlacementCandidate>();
  let attempts = 0;

  if (unplacedShips.length === 0) {
    return { board: workingBoard, ships: [...ships] };
  }

  const solve = (): boolean => {
    if (placements.size === unplacedShips.length) {
      return true;
    }

    // Pick the ship with the fewest legal positions first (MRV) so that
    // constrained ships do not make the search explode.
    let choice: {
      ship: TPendingShip;
      candidates: TPlacementCandidate[];
    } | null = null;

    for (const ship of unplacedShips) {
      if (placements.has(ship.id)) continue;

      const candidates = getCandidates(workingBoard, ship, size, random);
      if (candidates.length === 0) {
        return false;
      }

      if (!choice || candidates.length < choice.candidates.length) {
        choice = { ship, candidates };
      }
    }

    if (!choice) {
      return true;
    }

    for (const candidate of choice.candidates) {
      if (attempts >= MAX_ATTEMPTS) {
        return false;
      }

      placeShip(
        workingBoard,
        candidate.coords,
        choice.ship,
        candidate.orientation,
      );
      placements.set(choice.ship.id, candidate);
      attempts += 1;

      if (solve()) {
        return true;
      }

      placements.delete(choice.ship.id);
      removeShip(
        workingBoard,
        candidate.coords,
        choice.ship,
        candidate.orientation,
      );
    }

    return false;
  };

  if (!solve()) {
    return null;
  }

  return {
    board: workingBoard,
    ships: ships.map((ship) => {
      if (ship.placed) {
        return { ...ship };
      }

      const candidate = placements.get(ship.id);
      if (!candidate) {
        return { ...ship };
      }

      return {
        ...ship,
        placed: true,
        coords: candidate.coords,
        orientation: candidate.orientation,
        selected: false,
      };
    }),
  };
};
