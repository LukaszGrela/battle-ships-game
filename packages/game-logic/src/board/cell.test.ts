import { checkCoordsWithinBoard, getCell, setCell } from "./cell";

describe("cell helpers", () => {
  describe("checkCoordsWithinBoard", () => {
    it("accepts coordinates within the default 10 by 10 board", () => {
      expect(checkCoordsWithinBoard(0, 0)).toBe(1);
      expect(checkCoordsWithinBoard(9, 9)).toBe(1);
      expect(checkCoordsWithinBoard(5, 3)).toBe(1);
    });

    it("rejects x before y when either coordinate is outside the board", () => {
      expect(checkCoordsWithinBoard(-1, 0)).toBe(-101);
      expect(checkCoordsWithinBoard(10, 0)).toBe(-101);
      expect(checkCoordsWithinBoard(0, -1)).toBe(-102);
      expect(checkCoordsWithinBoard(0, 10)).toBe(-102);
      expect(checkCoordsWithinBoard(-1, -1)).toBe(-101);
    });

    it("uses a supplied board size", () => {
      expect(checkCoordsWithinBoard(2, 2, 3)).toBe(1);
      expect(checkCoordsWithinBoard(3, 0, 3)).toBe(-101);
      expect(checkCoordsWithinBoard(0, 3, 3)).toBe(-102);
    });
  });

  describe("getCell", () => {
    it("returns the value at valid coordinates", () => {
      const board = [
        ["a", "b"],
        ["c", "d"],
      ];

      expect(getCell(board, 1, 0, 2)).toBe("b");
      expect(getCell(board, 0, 1, 2)).toBe("c");
    });

    it("returns coordinate and missing-data failures", () => {
      expect(getCell([[1, 2]], -1, 0, 2)).toBe(-101);
      expect(getCell([[1, 2]], 0, 2, 2)).toBe(-102);
      expect(getCell([[1, 2]], 0, 1, 2)).toBe(-103);
      expect(getCell([[1]], 1, 0, 2)).toBe(-104);
    });
  });

  describe("setCell", () => {
    it("updates and returns the new value at valid coordinates", () => {
      const board = [
        ["a", "b"],
        ["c", "d"],
      ];

      expect(setCell(board, 1, 0, "updated", 2)).toBe("updated");
      expect(board[0]?.[1]).toBe("updated");
    });

    it("returns coordinate and missing-data failures without changing cells", () => {
      const board = [[1, 2]];

      expect(setCell(board, -1, 0, 9, 2)).toBe(-101);
      expect(setCell(board, 0, 2, 9, 2)).toBe(-102);
      expect(setCell(board, 0, 1, 9, 2)).toBe(-103);
      expect(setCell(board, 1, 0, 9, 2)).toBe(9);
      expect(board).toEqual([[1, 9]]);

      const missingCell = [[1]];
      expect(setCell(missingCell, 1, 0, 9, 2)).toBe(-104);
      expect(missingCell).toEqual([[1]]);
    });
  });
});
