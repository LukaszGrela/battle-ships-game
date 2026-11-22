import { TBoard, TShip } from "@repo/types";
import { autoPlaceShips } from "./autoPlaceShips";
import { createEmptyBoard } from "./createEmptyBoard";
import { placeShip } from "./placeShip";
import { seedRandom } from "../utils/seedRandom";

type TPendingShip = TShip & { type: "pending" };

const fleetSizes = [5, 4, 3, 3, 2] as const;

const createFleet = (): TPendingShip[] =>
  fleetSizes.map((size, index) => ({
    id: index + 1,
    size,
    type: "pending",
    placed: false,
  }));

const countShipCells = (board: TBoard): number =>
  board.flat().filter((cell) => cell !== -1).length;

describe("autoPlaceShips", () => {
  it("places every ship on an empty board without overlaps", () => {
    const board = createEmptyBoard();
    const ships = createFleet();
    const random = (() => {
      const seeded = seedRandom(42);
      return () => seeded.nextFloat();
    })();

    const result = autoPlaceShips(board, ships, random);

    expect(result).not.toBeNull();
    expect(result!.ships).toHaveLength(fleetSizes.length);
    expect(result!.ships.every((ship) => ship.placed)).toBe(true);
    expect(countShipCells(result!.board)).toBe(17);

    for (const ship of result!.ships) {
      expect(ship.placed).toBe(true);
      if (!ship.placed) continue;

      for (let offset = 0; offset < ship.size; offset++) {
        const x =
          ship.orientation === "horizontal"
            ? ship.coords.x + offset
            : ship.coords.x;
        const y =
          ship.orientation === "horizontal"
            ? ship.coords.y
            : ship.coords.y + offset;
        expect(result!.board[y]![x]).toBe(ship.id);
      }
    }
  });

  it("keeps already placed ships and only adds the remaining ones", () => {
    const board = createEmptyBoard();
    const ships = createFleet();
    const firstShip = ships[0]!;
    const coords = { x: 2, y: 2 };

    placeShip(board, coords, firstShip, "horizontal");
    ships[0] = {
      ...firstShip,
      placed: true,
      coords,
      orientation: "horizontal",
    };

    const result = autoPlaceShips(board, ships, () => 0.5);

    expect(result).not.toBeNull();
    expect(result!.ships[0]).toMatchObject({
      id: 1,
      placed: true,
      coords,
      orientation: "horizontal",
    });
    expect(result!.board[2]!.slice(2, 7)).toEqual([1, 1, 1, 1, 1]);
    expect(result!.ships.slice(1).every((ship) => ship.placed)).toBe(true);
    expect(countShipCells(result!.board)).toBe(17);
  });

  it("is deterministic for the same random seed", () => {
    const run = () => {
      const seeded = seedRandom(7);
      return autoPlaceShips(createEmptyBoard(), createFleet(), () =>
        seeded.nextFloat(),
      );
    };

    const first = run();
    const second = run();

    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });

  it("returns null and leaves the input board untouched when nothing fits", () => {
    const board = createEmptyBoard(2);
    const before = board.map((row) => [...row]);
    const ships: TPendingShip[] = [
      { id: 1, size: 3, type: "pending", placed: false },
    ];

    const result = autoPlaceShips(board, ships, () => 0.5, 2);

    expect(result).toBeNull();
    expect(board).toEqual(before);
  });

  it("returns an unchanged board when all ships are already placed", () => {
    const board = createEmptyBoard();
    const ships = createFleet().map((ship, index) => {
      const coords = { x: index * 2, y: 0 };
      placeShip(board, coords, ship, "horizontal");
      return {
        ...ship,
        placed: true as const,
        coords,
        orientation: "horizontal" as const,
      };
    });

    const result = autoPlaceShips(board, ships);

    expect(result).not.toBeNull();
    expect(result!.board).toEqual(board);
    expect(result!.ships).toEqual(ships);
  });
});
