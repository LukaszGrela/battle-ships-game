import {
  ISerializable,
  TCellStatus,
  TCellStatusEmpty,
  TCellStatusMiss,
  TCellStatusShip,
  TCellStatusShipDestroyed,
  TCellStatusShipDestroyedOffset,
  TCellStatusShipHit,
  TCellStatusShipHitOffset,
  TCoordinate,
  TShip,
  TShipPlacementOrientation,
} from "@repo/types";
import { Board } from "./Board";
import { TGetCellFailure } from "./cell";

const hitOffset: TCellStatusShipHitOffset = 100;
const destroyOffset: TCellStatusShipDestroyedOffset = 1000;

const deserializeToken = Symbol("BattleShipsBoard");

export class BattleShipsBoard implements ISerializable {
  private version: number = 1;
  private board!: Board;
  private ships: Map<string, TShip> = new Map();

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

  placeShip(ship: TShip) {
    const coords = ship.coords;
    const key = `${coords?.x},${coords?.y}`;
    if (coords && !this.ships.has(key)) {
      this.#paintShip(ship, ship.id as TCellStatusShip);

      this.ships.set(key, ship);
    }
  }

  removeShip(ship: TShip) {
    const coords = ship.coords;
    const key = `${coords?.x},${coords?.y}`;
    if (coords && this.ships.has(key)) {
      const empty: TCellStatusEmpty = -1;
      this.#paintShip(ship, empty);

      this.ships.delete(key);
    }
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

    if (this.#isShipStatus(current)) {
      // set hit
      const newStatus = (hitOffset + current) as TCellStatusShipHit;
      this.board.setCell(attackCoords.x, attackCoords.y, newStatus);

      // get ship
      const ship = this.#getShip(newStatus, attackCoords.x, attackCoords.y);
      if (ship && this.#shipDestroyed(ship)) {
        const destroyed = (destroyOffset + ship.id) as TCellStatusShipDestroyed;
        this.#paintShip(ship, destroyed);
        return destroyed;
      }
      //
      return newStatus;
    }

    if (
      this.#isHitShipStatus(current) ||
      this.#isDestroyedShipStatus(current)
    ) {
      return current;
    }

    this.board.setCell(attackCoords.x, attackCoords.y, miss);

    // miss
    return miss;
  }

  #paintShip(ship: TShip, paint: TCellStatus) {
    const coords = ship.coords;
    const orientation = ship.orientation;
    if (coords && orientation) {
      for (let offset = 0; offset < ship.size; offset++) {
        const placementCoords =
          orientation === "horizontal"
            ? { x: coords.x + offset, y: coords.y }
            : { x: coords.x, y: coords.y + offset };

        this.board.setCell(placementCoords.x, placementCoords.y, paint);
      }
    }
  }

  #getShip(shipId: TCellStatus, sx: number, sy: number): TShip | undefined {
    if (
      this.#isShipStatus(shipId) ||
      this.#isHitShipStatus(shipId) ||
      this.#isDestroyedShipStatus(shipId)
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

  #shipDestroyed(ship: TShip) {
    const coords = ship.coords;
    const orientation = ship.orientation;
    if (coords && orientation) {
      const destroyed = false;
      for (let offset = 0; offset < ship.size; offset++) {
        const placementCoords =
          orientation === "horizontal"
            ? { x: coords.x + offset, y: coords.y }
            : { x: coords.x, y: coords.y + offset };
        const cell = this.getCell(placementCoords.x, placementCoords.y);
        if (this.board.isCellFailure(cell) || this.#isShipStatus(cell)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  #isShipStatus(cell: TCellStatus): cell is TCellStatusShip {
    return cell >= 1 && cell <= 10;
  }
  #isHitShipStatus(cell: TCellStatus): cell is TCellStatusShipHit {
    return cell >= 101 && cell <= 110;
  }
  #isDestroyedShipStatus(cell: TCellStatus): cell is TCellStatusShipDestroyed {
    return cell >= 1001 && cell <= 1010;
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
            JSON.parse(ship),
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
      ships: Array.from(this.ships.entries()).map(([shipId, ship]) =>
        JSON.stringify({ shipId, ship }),
      ),
    });
  }
  static deserialize(data: string): BattleShipsBoard {
    return new BattleShipsBoard(data, deserializeToken);
  }
}
