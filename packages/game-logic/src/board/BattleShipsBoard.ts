import {
  ISerializable,
  TCellStatus,
  TCellStatusEmpty,
  TCellStatusMiss,
  TCellStatusShipId,
  TCellStatusShipDestroyed,
  TCellStatusShipDestroyedOffset,
  TCellStatusShipHit,
  TCellStatusShipHitOffset,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
  TPlacementValidationErrors,
  TPlacedShip,
  TBoard,
  TGetCellFailure,
} from "@repo/types";
import { Board } from "./Board";
import { isSunk } from "./isSunk";
import { isValidPlacement } from "./isValidPlacement";

const hitOffset: TCellStatusShipHitOffset = 100;
const destroyOffset: TCellStatusShipDestroyedOffset = 1000;

const deserializeToken = Symbol("BattleShipsBoard");

export class BattleShipsBoard implements ISerializable {
  private version: number = 1;
  private board!: Board;
  private ships: Map<string, TPlacedShip> = new Map();

  constructor();
  constructor(size: number);
  constructor(source: string, token: typeof deserializeToken);
  constructor(param: number | string = 10, token?: typeof deserializeToken) {
    if (typeof param === "number") {
      this.board = new Board(param);
    } else {
      if (param && token !== deserializeToken) {
        throw new Error("Use Board.deserialize() to create an instance.");
      }
      this.deserialize(param);
    }
  }

  getSize() {
    return this.board.getSize();
  }

  getCell(x: number, y: number): TCellStatus | TGetCellFailure {
    return this.board.getCell(x, y);
  }

  placeShip(
    ship: TShip & { type: "pending"; id: TCellStatusShipId },
    coords?: TCoordinate,
    orientation: TShipPlacementOrientation = "horizontal",
  ) {
    const key = `${coords?.x},${coords?.y}`;
    if (coords && !this.ships.has(key)) {
      // validation first
      const validation = this.isValidPlacement(coords, ship, orientation);
      if (validation !== 1) {
        return false;
      }

      const saveShip: TShip & { type: "placed" } = {
        ...ship,
        type: "placed",
        hits: [],
        coords,
        orientation,
      };

      // apply placement
      if (!this.#paintShip(saveShip, ship.id as TCellStatusShipId)) {
        return false;
      }

      this.ships.set(key, saveShip);
      return true;
    }
    return false;
  }

  removeShip(ship: TPlacedShip) {
    const coords = ship.coords;
    const key = `${coords?.x},${coords?.y}`;
    if (coords && this.ships.has(key)) {
      const empty: TCellStatusEmpty = -1;
      if (!this.#paintShip(ship, empty)) {
        return false;
      }

      this.ships.delete(key);
      return true;
    }
    return false;
  }

  resolveAttack(
    attackCoords: TCoordinate,
  ): TCellStatusShipHit | TCellStatusShipDestroyed | TCellStatusMiss {
    const miss: TCellStatusMiss = 0;
    const current = this.getCell(attackCoords.x, attackCoords.y);
    if (this.board.isCellFailure(current)) {
      // miss
      return miss;
    }

    if (isShipStatus(current)) {
      // set hit
      const newStatus = (hitOffset + current) as TCellStatusShipHit;
      this.board.setCell(attackCoords.x, attackCoords.y, newStatus);

      // get ship
      const ship = this.#getShip(newStatus, attackCoords.x, attackCoords.y);

      this.#setShipHit(ship, attackCoords);

      if (ship && this.#shipDestroyed(ship)) {
        const destroyed = (destroyOffset + ship.id) as TCellStatusShipDestroyed;
        this.#paintShip(ship, destroyed);
        return destroyed;
      }
      //
      return newStatus;
    }

    if (isHitShipStatus(current) || isDestroyedShipStatus(current)) {
      return current;
    }

    this.board.setCell(attackCoords.x, attackCoords.y, miss);

    // miss
    return miss;
  }
  getBoard(): TBoard<TCellStatus> {
    return this.board.getBoard();
  }
  clear() {
    this.board.clear();
    this.ships.clear();
  }

  getFleet() {
    return Array.from(this.ships.values()).map((ship) => structuredClone(ship));
  }

  fleetCount() {
    return this.ships.size;
  }

  fleetDestroyed() {
    return (
      this.fleetCount() > 0 &&
      !Array.from(this.ships.values()).some(
        (ship) => !isSunk(ship as unknown as TShip),
      )
    );
  }

  isValidPlacement(
    coords: TCoordinate,
    ship: TShip,
    orientation: TShipPlacementOrientation,
  ): TPlacementValidationErrors | 1 {
    const board = this.board.getBoard();

    return isValidPlacement(
      board,
      coords,
      ship,
      orientation,
      this.board.getSize(),
    );
  }

  getShipById(shipId: TCellStatusShipId): TPlacedShip | undefined {
    return Array.from(this.ships.values()).find((needle) => {
      return needle.id === shipId;
    });
  }

  #setShipHit(ship: TPlacedShip | undefined, attackCoords: TCoordinate) {
    if (ship) {
      const key = `${ship.coords.x},${ship.coords.y}`;
      const copy = structuredClone(ship);
      copy.hits.push(attackCoords);
      // save it
      this.ships.set(key, copy);
    }
  }

  #paintShip(ship: TPlacedShip, paint: TCellStatus): boolean {
    const coords = ship.coords;
    const orientation = ship.orientation;
    if (!coords || !orientation) {
      return false;
    }

    const previousCells: Array<{ x: number; y: number; value: TCellStatus }> =
      [];
    const rollback = () => {
      for (const cell of previousCells.reverse()) {
        this.board.setCell(cell.x, cell.y, cell.value);
      }
    };

    for (let offset = 0; offset < ship.size; offset++) {
      const placementCoords =
        orientation === "horizontal"
          ? { x: coords.x + offset, y: coords.y }
          : { x: coords.x, y: coords.y + offset };
      const previousValue = this.board.getCell(
        placementCoords.x,
        placementCoords.y,
      );

      if (this.board.isCellFailure(previousValue)) {
        rollback();
        return false;
      }

      previousCells.push({ ...placementCoords, value: previousValue });
      const result = this.board.setCell(
        placementCoords.x,
        placementCoords.y,
        paint,
      );
      if (this.board.isCellFailure(result)) {
        rollback();
        return false;
      }
    }

    return true;
  }

  #getShip(
    shipId: TCellStatus,
    sx: number,
    sy: number,
  ): TPlacedShip | undefined {
    if (
      isShipStatus(shipId) ||
      isHitShipStatus(shipId) ||
      isDestroyedShipStatus(shipId)
    ) {
      return Array.from(this.ships.values()).find((needle) => {
        if (
          needle.id === shipId ||
          needle.id + hitOffset === shipId ||
          needle.id + destroyOffset === shipId
        ) {
          // match coordinates
          const coords = needle.coords;
          const orientation = needle.orientation;
          if (coords && orientation) {
            if (orientation === "horizontal") {
              // horizontal: x + size
              return (
                sy === coords.y &&
                (sx >= coords.x || sx < coords.x + needle.size)
              );
            } else {
              // vertical: y + size
              return (
                sx === coords.x &&
                (sy >= coords.y || sy < coords.y + needle.size)
              );
            }
          }
        }
        return false;
      });
    }
    return undefined;
  }

  #shipDestroyed(ship: TPlacedShip) {
    const coords = ship.coords;
    const orientation = ship.orientation;
    if (coords && orientation) {
      for (let offset = 0; offset < ship.size; offset++) {
        const placementCoords =
          orientation === "horizontal"
            ? { x: coords.x + offset, y: coords.y }
            : { x: coords.x, y: coords.y + offset };
        const cell = this.getCell(placementCoords.x, placementCoords.y);
        if (this.board.isCellFailure(cell) || isShipStatus(cell)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  private deserialize(data: string): void {
    const parsed = JSON.parse(data, (key, value) => {
      if (key === "board") {
        return Board.deserialize(value);
      }
      if (key === "ships") {
        return new Map(
          value.map(({ shipId, ship }: { shipId: string; ship: string }) => [
            shipId,
            ship,
          ]),
        );
      }
      return value;
    });
    this.board = parsed.board;
    this.ships = parsed.ships;
  }

  serialize(): string {
    return JSON.stringify({
      version: this.version,
      board: this.board.serialize(),
      ships: Array.from(this.ships.entries()).map(([shipId, ship]) => ({
        shipId,
        ship,
      })),
    });
  }

  static deserialize(data: string): BattleShipsBoard {
    return new BattleShipsBoard(data, deserializeToken);
  }
}

export function isShipStatus(cell: TCellStatus): cell is TCellStatusShipId {
  return cell >= 1 && cell <= 10;
}
export function isHitShipStatus(cell: TCellStatus): cell is TCellStatusShipHit {
  return cell >= 101 && cell <= 110;
}
export function isDestroyedShipStatus(
  cell: TCellStatus,
): cell is TCellStatusShipDestroyed {
  return cell >= 1001 && cell <= 1010;
}
