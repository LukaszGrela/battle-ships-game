import { ECellStatus, TBoard, TShip } from "@repo/types";
import {
  cellIsEmpty,
  checkBreathingSpace,
  isValidPlacement,
  spaceForShipIsEmpty,
} from "./isValidPlacement";
import { placeShip } from "./placeShip";

const createBoard = (size: number): TBoard<ECellStatus> =>
  Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ECellStatus.Empty),
  );

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
      board[1]![1] = ECellStatus.Ship;

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

      board[1]![2] = ECellStatus.Ship;
      expect(
        spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "horizontal"),
      ).toBe(false);
    });

    it("checks every cell along a vertical placement", () => {
      const board = createBoard(4);

      expect(spaceForShipIsEmpty(board, { x: 1, y: 1 }, ship, "vertical")).toBe(
        true,
      );

      board[2]![1] = ECellStatus.Ship;
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
      expect(
        checkBreathingSpace(createBoard(5), { x: 1, y: 2 }, ship, "horizontal"),
      ).toBe(true);
    });

    it.each([
      ["bow", { x: 3, y: 2 }],
      ["stern", { x: 0, y: 2 }],
      ["port", { x: 1, y: 1 }],
      ["starboard", { x: 2, y: 3 }],
    ] as const)("rejects an occupied horizontal %s cell", (_name, coords) => {
      const board = createBoard(5);
      board[coords.y]![coords.x] = ECellStatus.Ship;

      expect(
        checkBreathingSpace(board, { x: 1, y: 2 }, ship, "horizontal"),
      ).toBe(false);
    });

    it("accepts clear vertical ship ends and adjacent sides", () => {
      expect(
        checkBreathingSpace(createBoard(5), { x: 2, y: 1 }, ship, "vertical"),
      ).toBe(true);
    });

    it.each([
      ["bow", { x: 2, y: 3 }],
      ["stern", { x: 2, y: 0 }],
      ["port", { x: 3, y: 1 }],
      ["starboard", { x: 1, y: 2 }],
    ] as const)("rejects an occupied vertical %s cell", (_name, coords) => {
      const board = createBoard(5);
      board[coords.y]![coords.x] = ECellStatus.Ship;

      expect(checkBreathingSpace(board, { x: 2, y: 1 }, ship, "vertical")).toBe(
        false,
      );
    });

    it("allows breathing-space coordinates outside the board", () => {
      expect(
        checkBreathingSpace(createBoard(3), { x: 0, y: 1 }, ship, "horizontal"),
      ).toBe(true);
    });
  });

  describe("isValidPlacement", () => {
    it("returns 1 for a valid placement", () => {
      expect(
        isValidPlacement(createBoard(5), { x: 1, y: 2 }, ship, "horizontal"),
      ).toBe(1);
    });

    it("returns -1 when the starting cell is occupied or out of bounds", () => {
      const board = createBoard(5);
      board[2]![1] = ECellStatus.Ship;

      expect(isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal")).toBe(
        -1,
      );
      expect(isValidPlacement(board, { x: -1, y: 2 }, ship, "horizontal")).toBe(
        -1,
      );
    });

    it("returns -2 when the ship does not fit or overlaps another ship", () => {
      const board = createBoard(5);

      expect(isValidPlacement(board, { x: 4, y: 2 }, ship, "horizontal")).toBe(
        -2,
      );

      board[2]![2] = ECellStatus.Ship;
      expect(isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal")).toBe(
        -2,
      );
    });

    it("returns -3 when the ship has no required breathing space", () => {
      const board = createBoard(5);
      board[1]![1] = ECellStatus.Ship;

      expect(isValidPlacement(board, { x: 1, y: 2 }, ship, "horizontal")).toBe(
        -3,
      );
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
});
