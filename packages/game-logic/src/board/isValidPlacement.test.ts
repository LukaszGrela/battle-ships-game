import {
  TBoard,
  TCellStatus,
  TCellStatusEmpty,
  TInvalidXCoordinate,
  TInvalidYCoordinate,
  TPlacementValidationErrors,
  TShip,
} from "@repo/types";
import {
  cellIsEmpty,
  checkBreathingSpace,
  isCellFailure,
  isValidPlacement,
  spaceForShipIsEmpty,
} from "./isValidPlacement";
import { placeShip } from "./placeShip";
import { setCell } from "./cell";

const empty: TCellStatusEmpty = -1;

const createBoard = (size: number): TBoard<TCellStatus> =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => empty));

const ship: TShip = {
  id: 1,
  size: 2,
  type: "pending",
  placed: false,
};

describe("isValidPlacement helpers", () => {
  describe("cellIsEmpty", () => {
    it("returns true only for an empty in-bounds cell", () => {
      const board = createBoard(3);
      board[1]![1] = 1;

      expect(cellIsEmpty(board, { x: 0, y: 0 })).toBe(true);
      expect(cellIsEmpty(board, { x: 1, y: 1 })).toBe(false);
      expect(cellIsEmpty(board, { x: -1, y: 0 })).toBe(false);
      expect(cellIsEmpty(board, { x: 0, y: 3 })).toBe(false);
    });
  });

  describe("spaceForShipIsEmpty", () => {
    it("checks every cell along a horizontal placement", () => {
      const board = createBoard(4);

      expect(
        spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "horizontal"),
      ).toBe(true);

      board[1]![2] = 1;
      expect(
        spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "horizontal"),
      ).toBe(false);
    });

    it("checks every cell along a vertical placement", () => {
      const board = createBoard(4);

      expect(spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "vertical")).toBe(
        true,
      );

      board[2]![1] = 1;
      expect(spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "vertical")).toBe(
        false,
      );
    });

    it("rejects a placement that extends beyond the board", () => {
      const board = createBoard(3);

      expect(
        spaceForShipIsEmpty(board, { x: 2, y: 1 }, ship, "horizontal"),
      ).toBe(false);
      expect(spaceForShipIsEmpty(board, { x: 1, y: 2 }, ship, "vertical")).toBe(
        false,
      );
    });
  });

  describe("checkBreathingSpace", () => {
    it("accepts clear horizontal ship ends and adjacent sides", () => {
      const size = 5;
      expect(
        checkBreathingSpace(
          createBoard(size),
          { x: 1, y: 2 },
          ship,
          "horizontal",
          size,
        ),
      ).toBe(true);
    });

    it.each([
      ["bow", { x: 3, y: 2 }],
      ["stern", { x: 0, y: 2 }],
      ["port", { x: 1, y: 1 }],
      ["starboard", { x: 2, y: 3 }],
    ] as const)("rejects an occupied horizontal %s cell", (_name, coords) => {
      const size = 5;
      const board = createBoard(size);
      board[coords.y]![coords.x] = 1;

      expect(
        checkBreathingSpace(board, { x: 1, y: 2 }, ship, "horizontal", size),
      ).toBe(false);
    });

    it("accepts clear vertical ship ends and adjacent sides", () => {
      const size = 5;
      expect(
        checkBreathingSpace(
          createBoard(size),
          { x: 2, y: 1 },
          ship,
          "vertical",
          size,
        ),
      ).toBe(true);
    });

    it.each([
      ["bow", { x: 2, y: 3 }],
      ["stern", { x: 2, y: 0 }],
      ["port", { x: 3, y: 1 }],
      ["starboard", { x: 1, y: 2 }],
    ] as const)("rejects an occupied vertical %s cell", (_name, coords) => {
      const size = 5;
      const board = createBoard(size);
      board[coords.y]![coords.x] = 1;

      expect(
        checkBreathingSpace(board, { x: 2, y: 1 }, ship, "vertical", size),
      ).toBe(false);
    });

    it("allows breathing-space coordinates outside the board", () => {
      const size = 3;
      expect(
        checkBreathingSpace(
          createBoard(size),
          { x: 0, y: 1 },
          ship,
          "horizontal",
          size,
        ),
      ).toBe(true);
    });
  });

  describe("isValidPlacement", () => {
    it.each([
      // ["top row", { x: 1, y: 0 }, "horizontal"],
      ["bottom row", { x: 1, y: 4 }, "horizontal"],
      // ["left column", { x: 0, y: 1 }, "vertical"],
      // ["right column", { x: 4, y: 1 }, "vertical"],
    ] as const)("allows placement on the %s", (_edge, coords, orientation) => {
      const size = 5;
      const board = createBoard(size);

      expect(isValidPlacement(board, coords, ship, orientation, size)).toBe(1);
    });

    it("returns 1 for a valid placement", () => {
      const size = 5;
      expect(
        isValidPlacement(
          createBoard(size),
          { x: 1, y: 2 },
          ship,
          "horizontal",
          size,
        ),
      ).toBe(1);
    });

    it("returns -1001 when the starting cell is occupied", () => {
      const size = 5;
      const board = createBoard(size);
      board[2]![1] = 1;

      const cellNotEmpty: TPlacementValidationErrors = -1001;
      expect(
        isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal", size),
      ).toBe(cellNotEmpty);

      const invalidXCoord: TInvalidXCoordinate = -101;
      expect(
        isValidPlacement(board, { x: -1, y: 2 }, ship, "horizontal", size),
      ).toBe(invalidXCoord);
    });
    it("returns -101 | -102 when the coords are out of bounds", () => {
      const size = 5;
      const board = createBoard(size);

      const invalidXCoord: TInvalidXCoordinate = -101;
      expect(
        isValidPlacement(board, { x: -1, y: 2 }, ship, "horizontal", size),
      ).toBe(invalidXCoord);

      expect(
        isValidPlacement(board, { x: 6, y: 2 }, ship, "horizontal", size),
      ).toBe(invalidXCoord);

      const invalidYCoord: TInvalidYCoordinate = -102;
      expect(
        isValidPlacement(board, { x: 2, y: -1 }, ship, "horizontal", size),
      ).toBe(invalidYCoord);

      expect(
        isValidPlacement(board, { x: 1, y: 6 }, ship, "horizontal", size),
      ).toBe(invalidYCoord);
    });

    it("returns -1002 when the ship does not fit or overlaps another ship", () => {
      const size = 5;
      const board = createBoard(size);

      const noSpaceForShip: TPlacementValidationErrors = -1002;
      expect(
        isValidPlacement(board, { x: 4, y: 2 }, ship, "horizontal", size),
      ).toBe(noSpaceForShip);

      board[2]![2] = 1;
      expect(
        isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal", size),
      ).toBe(noSpaceForShip);
    });

    it("returns -1003 when the ship has no required breathing space", () => {
      const size = 5;
      const board = createBoard(size);
      board[1]![1] = 1;

      const noBreathingSpace: TPlacementValidationErrors = -1003;

      expect(
        isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal", size),
      ).toBe(noBreathingSpace);
    });
    it("validates correct ship list", () => {
      const ships = [
        {
          id: 0,
          type: "pending" as const,
          size: 5,
          placed: true,
          coords: {
            x: 3,
            y: 0,
          },
          orientation: "horizontal" as const,
        },
        {
          id: 1,
          type: "pending" as const,
          size: 4,
          placed: true,
          coords: {
            x: 3,
            y: 2,
          },
          orientation: "horizontal" as const,
        },
        {
          id: 2,
          type: "pending" as const,
          size: 3,
          placed: true,
          coords: {
            x: 0,
            y: 1,
          },
          orientation: "horizontal" as const,
        },
        {
          id: 3,
          type: "pending" as const,
          size: 3,
          placed: true,
          coords: {
            x: 7,
            y: 3,
          },
          orientation: "horizontal" as const,
        },
        {
          id: 4,
          type: "pending" as const,
          size: 2,
          placed: true,
          coords: {
            x: 8,
            y: 1,
          },
          orientation: "horizontal" as const,
        },
      ];
      const board = createBoard(10);
      let placed = 0;
      ships.forEach((ship) => {
        if (isValidPlacement(board, ship.coords, ship, ship.orientation)) {
          placeShip(board, ship.coords, ship, ship.orientation);
          placed++;
        }
      });
      expect(placed).toBe(ships.length);
    });
  });

  describe("isCellFailure", () => {
    it("recognizes all cell failure codes", () => {
      for (const failure of [-101, -102, -103, -104, -105] as const) {
        expect(isCellFailure(failure)).toBe(true);
      }
    });

    it("does not treat valid cell values or unrelated numbers as failures", () => {
      for (const value of [-2, -1, 0, 1, 101, 1001] as const) {
        expect(isCellFailure(value)).toBe(false);
      }
    });
  });

  describe("battle ships board tests", () => {
    it("exposes empty-cell, ship-span, and breathing-space checks", () => {
      const size = 5;
      const board = createBoard(size);
      const coords = { x: 1, y: 2 };

      expect(cellIsEmpty(board, coords, size)).toBe(true);
      expect(spaceForShipIsEmpty(board, coords, ship, "horizontal", size)).toBe(
        true,
      );
      expect(checkBreathingSpace(board, coords, ship, "horizontal", size)).toBe(
        true,
      );

      setCell(board, 2, 2, 101, size);
      expect(cellIsEmpty(board, { x: 2, y: 2 }, size)).toBe(false);
      expect(spaceForShipIsEmpty(board, coords, ship, "horizontal", size)).toBe(
        false,
      );
      setCell(board, 1, 1, 101, size);
      expect(checkBreathingSpace(board, coords, ship, "horizontal", size)).toBe(
        false,
      );
      expect(cellIsEmpty(board, { x: -1, y: 0 }, size)).toBe(false);
    });
  });
});
