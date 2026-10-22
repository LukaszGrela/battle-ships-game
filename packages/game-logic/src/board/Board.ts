import {
  TCellStatus,
  ISerializable,
  TBoard,
  TCellStatusEmpty,
} from "@repo/types";
import { TGetCellFailure } from "./cell";

const deserializeToken = Symbol("Board");

export class Board implements ISerializable {
  private version: number = 1;
  private board: TBoard<TCellStatus> = [];
  private size: number = 10;

  constructor();
  constructor(size: number);
  constructor(source: string, token: typeof deserializeToken);
  constructor(param: number | string = 10, token?: typeof deserializeToken) {
    if (typeof param === "number") {
      this.size = param;
      this.board = Array.from({ length: this.size }, () =>
        Array.from({ length: this.size }, (): TCellStatusEmpty => -1),
      );
    } else {
      if (param && token !== deserializeToken) {
        throw new Error("Use Board.deserialize() to create an instance.");
      }
      this.deserialize(param);
    }
  }

  getSize() {
    return this.size;
  }

  getCell(x: number, y: number): TCellStatus | TGetCellFailure {
    if (x < 0 || x >= this.size) return -101;
    if (y < 0 || y >= this.size) return -102;

    const row = this.board.at(y);
    if (row == undefined) {
      return -103;
    }
    const cell = row.at(x);
    if (cell == undefined) {
      return -104;
    }
    return cell;
  }

  setCell(
    x: number,
    y: number,
    value: TCellStatus,
  ): TCellStatus | TGetCellFailure {
    if (x < 0 || x >= this.size) return -101;
    if (y < 0 || y >= this.size) return -102;

    const row = this.board.at(y);
    if (row == undefined) {
      return -103;
    }
    const cell = row.at(x);
    if (cell == undefined) {
      return -104;
    }

    // update cell
    row[x] = value;

    return value;
  }

  clear() {
    this.board = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, (): TCellStatusEmpty => -1),
    );
  }

  getBoard(): TBoard<TCellStatus> {
    return structuredClone(this.board);
  }
  /**
   * Replaces the value of the cell at (x, y) and every 4-directionally
   * connected cell that shares its original value with `newValue`.
   * Does nothing if the start coordinate is out of bounds or already
   * holds `newValue`.
   */
  protected _floodFill(x: number, y: number, newValue: TCellStatus) {
    const originalValue = this.getCell(x, y);
    if (isCellFailure(originalValue) || originalValue === newValue) {
      return;
    }

    // Iterative (stack-based) fill to avoid recursion limits on large boards
    const stack: Array<[number, number]> = [[x, y]];

    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;

      // Skip out-of-bounds and already repainted cells.
      // Repainted cells hold `newValue`, which differs from `originalValue`,
      // so this comparison doubles as the visited check.
      const cell = this.getCell(cx, cy);
      if (isCellFailure(cell) || cell !== originalValue) {
        continue;
      }

      this.setCell(cx, cy, newValue);

      // 4-directional neighbors
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  protected deserialize(data: string): void {
    const parsed = JSON.parse(data);
    if (parsed.version !== this.version) {
      throw new Error(`Unsupported version: ${parsed.version}`);
    }

    this.board = parsed.board;
    this.size = parsed.size;
  }

  serialize(): string {
    // Implementation for serializing the board
    return JSON.stringify(this);
  }

  static deserialize: (serialized: string) => Board = (
    serialized: string,
  ): Board => {
    return new Board(serialized, deserializeToken);
  };
}

export const isCellFailure = (
  cell: TCellStatus | TGetCellFailure,
): cell is TGetCellFailure => {
  return cell <= -101 && cell >= -105;
};
