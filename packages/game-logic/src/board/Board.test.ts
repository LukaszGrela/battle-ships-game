import { TCellStatus } from "@repo/types";
import { Board } from "./Board";

// Exposes the protected _floodFill for testing
class TestBoard extends Board {
  floodFill(x: number, y: number, newValue: TCellStatus) {
    this._floodFill(x, y, newValue);
  }
}

// Whole-board view via the public API, for grid equality assertions
const gridOf = (board: Board) =>
  Array.from({ length: board.getSize() }, (_, y) =>
    Array.from({ length: board.getSize() }, (_, x) => board.getCell(x, y)),
  );

describe("Board", () => {
  describe("construction", () => {
    it("creates a default 10 by 10 empty board", () => {
      const board = new Board();

      expect(board.getSize()).toBe(10);
      expect(board.getCell(0, 0)).toBe(-1);
      expect(board.getCell(9, 9)).toBe(-1);
    });

    it("creates an empty board with the requested size", () => {
      const board = new Board(3);

      expect(board.getSize()).toBe(3);
      expect(board.getCell(2, 2)).toBe(-1);
    });
  });

  describe("getCell", () => {
    it("returns the value at the requested coordinates", () => {
      const board = new Board(2);
      board.setCell(1, 0, 5);

      expect(board.getCell(1, 0)).toBe(5);
    });

    it("returns coordinate failures for out-of-range coordinates", () => {
      const board = new Board(2);

      expect(board.getCell(-1, 0)).toBe(-101);
      expect(board.getCell(2, 0)).toBe(-101);
      expect(board.getCell(0, -1)).toBe(-102);
      expect(board.getCell(0, 2)).toBe(-102);
    });

    it("returns failures for missing rows and cells in deserialized boards", () => {
      const boardWithMissingRow = Board.deserialize(
        JSON.stringify({ version: 1, size: 2, board: [[1], null] }),
      );
      const boardWithMissingCell = Board.deserialize(
        JSON.stringify({ version: 1, size: 2, board: [[1], [2, 3]] }),
      );

      expect(boardWithMissingRow.getCell(0, 1)).toBe(-103);
      expect(boardWithMissingCell.getCell(1, 0)).toBe(-104);
    });
  });

  describe("setCell", () => {
    it("updates a cell and returns success", () => {
      const board = new Board(2);

      expect(board.setCell(1, 0, 7)).toBe(7);
      expect(board.getCell(1, 0)).toBe(7);
    });

    it("returns coordinate failures for out-of-range coordinates without updating", () => {
      const board = new Board(2);

      expect(board.setCell(-1, 0, 7)).toBe(-101);
      expect(board.setCell(2, 0, 7)).toBe(-101);
      expect(board.setCell(0, -1, 7)).toBe(-102);
      expect(board.setCell(0, 2, 7)).toBe(-102);
      expect(board.getCell(0, 0)).toBe(-1); // empty cell, TCellStatusEmpty
    });

    it("returns failures for missing rows and cells without updating", () => {
      const boardWithMissingRow = Board.deserialize(
        JSON.stringify({ version: 1, size: 2, board: [[1], null] }),
      );
      const boardWithMissingCell = Board.deserialize(
        JSON.stringify({ version: 1, size: 2, board: [[1], [2, 3]] }),
      );

      expect(boardWithMissingRow.setCell(0, 1, 8)).toBe(-103);
      expect(boardWithMissingCell.setCell(1, 0, 8)).toBe(-104);
      expect(boardWithMissingCell.getCell(0, 0)).toBe(1);
    });
  });

  describe("clear", () => {
    it("clears the board", () => {
      const board = new Board(2);
      expect(board.setCell(1, 0, 7)).toBe(7);
      expect(board.setCell(0, 1, 7)).toBe(7);

      expect(board.getCell(1, 0)).toBe(7);
      expect(board.getCell(0, 1)).toBe(7);

      board.clear();

      expect(board.getCell(1, 0)).toBe(-1);
      expect(board.getCell(0, 1)).toBe(-1);
    });
  });

  describe("isCellFailure", () => {
    it("recognizes all cell failure codes", () => {
      const board = new Board(1);

      for (const failure of [-101, -102, -103, -104, -105] as const) {
        expect(board.isCellFailure(failure)).toBe(true);
      }
    });

    it("does not treat valid cell values or unrelated numbers as failures", () => {
      const board = new Board(1);

      for (const value of [-2, -1, 0, 1, 101, 1001] as const) {
        expect(board.isCellFailure(value)).toBe(false);
      }
    });
  });

  describe("_floodFill", () => {
    it("replaces only the four-directionally connected cells with the original value", () => {
      const board = new TestBoard(4);
      board.setCell(0, 0, 1);
      board.setCell(1, 0, 1);
      board.setCell(1, 1, 1);
      board.setCell(3, 3, 1);

      board.floodFill(0, 0, 2);

      expect(gridOf(board)).toEqual([
        [2, 2, -1, -1],
        [-1, 2, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, -1, 1],
      ]);
    });

    it("does nothing when the start is out of bounds or already has the new value", () => {
      const board = new TestBoard(2);
      board.setCell(0, 0, 2);
      board.setCell(1, 1, 1);

      board.floodFill(-1, 0, 3);
      board.floodFill(0, 0, 3);
      board.floodFill(1, 1, 1);

      expect(gridOf(board)).toEqual([
        [3, -1],
        [-1, 1],
      ]);
    });
  });

  describe("serialization", () => {
    it("serializes and restores board contents", () => {
      const original = new Board(2);
      original.setCell(1, 0, 5);

      const restored = Board.deserialize(original.serialize());

      expect(restored).toBeInstanceOf(Board);
      expect(restored.getSize()).toBe(2);
      expect(restored.getCell(1, 0)).toBe(5);
      expect(restored.getCell(0, 1)).toBe(-1);
    });

    it("rejects unsupported serialized versions", () => {
      expect(() => Board.deserialize('{"version":2,"board":[]}')).toThrow(
        "Unsupported version: 2",
      );
    });
  });
});
