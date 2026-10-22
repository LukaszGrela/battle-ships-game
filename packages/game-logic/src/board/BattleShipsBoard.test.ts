import {
  TCellStatus,
  TCellStatusShipId,
  TPlacedShip,
  TShip,
} from "@repo/types";
import {
  BattleShipsBoard,
  isDestroyedShipStatus,
  isHitShipStatus,
  isShipStatus,
} from "./BattleShipsBoard";

describe("BattleShipsBoard", () => {
  describe("board and fleet state", () => {
    it("uses the default size when none is provided", () => {
      expect(new BattleShipsBoard().getSize()).toBe(10);
    });

    it("tracks successfully placed ships and prevents duplicate or invalid placements", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 2,
        type: "pending",
        placed: true,
      };
      const coords = { x: 1, y: 2 };

      expect(board.fleetCount()).toBe(0);
      expect(board.placeShip(ship, coords)).toBe(true);
      expect(board.fleetCount()).toBe(1);
      expect(board.getShipById(ship.id)).toMatchObject({
        ...ship,
        type: "placed",
        coords,
        orientation: "horizontal",
        hits: [],
      });
      expect(board.placeShip(ship, coords)).toBe(false);
      expect(
        board.placeShip({ ...ship, id: 2 }, { x: 2, y: 2 }),
      ).toBe(false);
      expect(board.placeShip(ship, { x: 4, y: 2 })).toBe(false);
      expect(board.fleetCount()).toBe(1);
    });

    it("returns board and fleet copies without exposing internal state", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 2,
        type: "pending",
        placed: true,
      };
      board.placeShip(ship, { x: 1, y: 2 });

      const boardCopy = board.getBoard();
      boardCopy[2]![1] = -1;
      const fleetCopy = board.getFleet();
      fleetCopy[0]!.hits.push({ x: 1, y: 2 });
      fleetCopy.pop();

      expect(board.getCell(1, 2)).toBe(1);
      expect(board.getFleet()).toHaveLength(1);
      expect(board.getShipById(ship.id)?.hits).toEqual([]);
    });

    it("removes a placed ship and resets its cells", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 2,
        type: "pending",
        placed: true,
      };
      board.placeShip(ship, { x: 1, y: 2 }, "vertical");
      const placedShip = board.getShipById(ship.id) as TPlacedShip;

      expect(board.removeShip(placedShip)).toBe(true);
      expect(board.fleetCount()).toBe(0);
      expect(board.getShipById(ship.id)).toBeUndefined();
      expect(board.getCell(1, 2)).toBe(-1);
      expect(board.getCell(1, 3)).toBe(-1);
      expect(board.removeShip(placedShip)).toBe(false);
    });

    it("clears cells and registered ships", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 2,
        type: "pending",
        placed: true,
      };
      board.placeShip(ship, { x: 1, y: 2 });
      board.resolveAttack({ x: 4, y: 4 });

      board.clear();

      expect(board.fleetCount()).toBe(0);
      expect(board.fleetDestroyed()).toBe(false);
      expect(board.getShipById(ship.id)).toBeUndefined();
      expect(board.getCell(1, 2)).toBe(-1);
      expect(board.getCell(4, 4)).toBe(-1);
    });
  });

  describe("attacks and fleet destruction", () => {
    it("marks empty cells as misses and reports out-of-bounds attacks as misses", () => {
      const board = new BattleShipsBoard(4);

      expect(board.resolveAttack({ x: 1, y: 1 })).toBe(0);
      expect(board.getCell(1, 1)).toBe(0);
      expect(board.resolveAttack({ x: 1, y: 1 })).toBe(0);
      expect(board.resolveAttack({ x: -1, y: 1 })).toBe(0);
      expect(board.resolveAttack({ x: 4, y: 1 })).toBe(0);
    });

    it("records ship hits, sinks the ship, and marks the whole ship destroyed", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 3,
        size: 2,
        type: "pending",
        placed: true,
      };
      board.placeShip(ship, { x: 1, y: 2 }, "horizontal");

      expect(board.resolveAttack({ x: 1, y: 2 })).toBe(103);
      expect(board.fleetDestroyed()).toBe(false);
      expect(board.getShipById(ship.id)?.hits).toEqual([{ x: 1, y: 2 }]);

      expect(board.resolveAttack({ x: 1, y: 2 })).toBe(103);
      expect(board.getShipById(ship.id)?.hits).toEqual([{ x: 1, y: 2 }]);

      expect(board.resolveAttack({ x: 2, y: 2 })).toBe(1003);
      expect(board.getCell(1, 2)).toBe(1003);
      expect(board.getCell(2, 2)).toBe(1003);
      expect(board.getShipById(ship.id)?.hits).toEqual([
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ]);
      expect(board.fleetDestroyed()).toBe(true);
      expect(board.resolveAttack({ x: 2, y: 2 })).toBe(1003);
    });

    it("reports the fleet destroyed only after every ship is sunk", () => {
      const board = new BattleShipsBoard(7);
      const firstShip: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 1,
        type: "pending",
        placed: true,
      };
      const secondShip: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 2,
        size: 1,
        type: "pending",
        placed: true,
      };
      board.placeShip(firstShip, { x: 1, y: 1 });
      board.placeShip(secondShip, { x: 4, y: 4 });

      expect(board.fleetCount()).toBe(2);
      expect(board.fleetDestroyed()).toBe(false);
      expect(board.resolveAttack({ x: 1, y: 1 })).toBe(1001);
      expect(board.fleetDestroyed()).toBe(false);
      expect(board.resolveAttack({ x: 4, y: 4 })).toBe(1002);
      expect(board.fleetDestroyed()).toBe(true);
    });
  });

  describe("serialization", () => {
    it("round-trips board cells and ship hit state", () => {
      const board = new BattleShipsBoard(5);
      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 2,
        size: 2,
        type: "pending",
        placed: true,
      };
      board.placeShip(ship, { x: 1, y: 2 }, "vertical");
      board.resolveAttack({ x: 1, y: 2 });
      board.resolveAttack({ x: 4, y: 4 });

      const restored = BattleShipsBoard.deserialize(board.serialize());

      expect(restored.getSize()).toBe(5);
      expect(restored.getCell(1, 2)).toBe(102);
      expect(restored.getCell(1, 3)).toBe(2);
      expect(restored.getCell(4, 4)).toBe(0);
      expect(restored.getShipById(ship.id)).toEqual(board.getShipById(ship.id));
      expect(restored.fleetCount()).toBe(1);
      expect(restored.fleetDestroyed()).toBe(false);
    });
  });

  describe("edge ship placement", () => {
    const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
      id: 1,
      size: 2,
      type: "pending",
      placed: true,
    };

    it.each([
      ["top row", { x: 1, y: 0 }, "horizontal"],
      ["bottom row", { x: 1, y: 4 }, "horizontal"],
      ["left column", { x: 0, y: 1 }, "vertical"],
      ["right column", { x: 4, y: 1 }, "vertical"],
    ] as const)("allows placement on the %s", (_edge, coords, orientation) => {
      const board = new BattleShipsBoard(5);

      expect(board.isValidPlacement(coords, ship, orientation)).toBe(1);
      expect(board.placeShip(ship, coords, orientation)).toBe(true);
      expect(board.getCell(coords.x, coords.y)).toBe(ship.id);
    });
  });

  describe("placement validation", () => {
    const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
      id: 1,
      size: 2,
      type: "pending",
      placed: true,
    };

    it("distinguishes occupied start, occupied ship span, and blocked breathing space", () => {
      const occupiedStart = new BattleShipsBoard(5);
      occupiedStart.placeShip(
        { ...ship, id: 2 },
        { x: 1, y: 2 },
      );
      expect(occupiedStart.isValidPlacement({ x: 1, y: 2 }, ship, "horizontal")).toBe(
        -1001,
      );

      const occupiedSpan = new BattleShipsBoard(5);
      occupiedSpan.placeShip(
        { ...ship, id: 2 },
        { x: 2, y: 2 },
      );
      expect(occupiedSpan.isValidPlacement({ x: 1, y: 2 }, ship, "horizontal")).toBe(
        -1002,
      );

      const blockedBreathingSpace = new BattleShipsBoard(5);
      blockedBreathingSpace.placeShip(
        { ...ship, id: 2 },
        { x: 1, y: 1 },
      );
      expect(
        blockedBreathingSpace.isValidPlacement(
          { x: 1, y: 2 },
          ship,
          "horizontal",
        ),
      ).toBe(-1003);
    });

    it("exposes empty-cell, ship-span, and breathing-space checks", () => {
      const board = new BattleShipsBoard(5);
      const coords = { x: 1, y: 2 };

      expect(board.cellIsEmpty(coords)).toBe(true);
      expect(board.spaceForShipIsEmpty(coords, ship, "horizontal")).toBe(true);
      expect(board.checkBreathingSpace(coords, ship, "horizontal")).toBe(true);

      board.resolveAttack({ x: 2, y: 2 });
      expect(board.cellIsEmpty({ x: 2, y: 2 })).toBe(false);
      expect(board.spaceForShipIsEmpty(coords, ship, "horizontal")).toBe(false);
      board.resolveAttack({ x: 1, y: 1 });
      expect(board.checkBreathingSpace(coords, ship, "horizontal")).toBe(false);
      expect(board.cellIsEmpty({ x: -1, y: 0 })).toBe(false);
    });
  });

  describe("cell status helpers", () => {
    it.each([
      [1, true, false, false],
      [10, true, false, false],
      [101, false, true, false],
      [110, false, true, false],
      [1001, false, false, true],
      [1010, false, false, true],
      [-1, false, false, false],
      [0, false, false, false],
      [11, false, false, false],
      [111, false, false, false],
    ] as const)(
      "classifies status %i correctly",
      (status, isShip, isHit, isDestroyed) => {
        const cellStatus = status as TCellStatus;
        expect(isShipStatus(cellStatus)).toBe(isShip);
        expect(isHitShipStatus(cellStatus)).toBe(isHit);
        expect(isDestroyedShipStatus(cellStatus)).toBe(isDestroyed);
      },
    );
  });

  describe("ship painting rollback", () => {
    it("restores already-painted cells and leaves the ship unregistered when a cell write fails", () => {
      const board = new BattleShipsBoard(5);
      const boardInternals = board as unknown as {
        board: {
          setCell: (
            x: number,
            y: number,
            value: TCellStatus,
          ) => TCellStatus | number;
        };
      };
      const originalSetCell = boardInternals.board.setCell.bind(
        boardInternals.board,
      );

      const ship: TShip & { type: "pending"; id: TCellStatusShipId } = {
        id: 1,
        size: 3,
        type: "pending",
        placed: true,
      };
      const coords = { x: 1, y: 2 };
      expect(board.isValidPlacement(coords, ship, "horizontal")).toBe(1);

      const setCellSpy = vi.spyOn(boardInternals.board, "setCell");
      setCellSpy
        .mockImplementationOnce((x, y, value) => originalSetCell(x, y, value))
        .mockImplementationOnce((x, y, value) => {
          originalSetCell(x, y, value);
          return -104;
        });

      expect(board.placeShip(ship, coords, "horizontal")).toBe(false);
      expect(board.getCell(1, 2)).toBe(-1);
      expect(board.getCell(2, 2)).toBe(-1);
      expect(board.getCell(3, 2)).toBe(-1);
      expect(JSON.parse(board.serialize()).ships).toEqual([]);
      expect(setCellSpy).toHaveBeenCalledTimes(4);
    });
  });
  describe("isValidPlacement", () => {
    it("validates correct ship list", () => {
      const ships = [
        {
          id: 10 as TCellStatusShipId,
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
          id: 1 as TCellStatusShipId,
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
          id: 2 as TCellStatusShipId,
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
          id: 3 as TCellStatusShipId,
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
          id: 4 as TCellStatusShipId,
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
      const board = new BattleShipsBoard(10);
      let placed = 0;
      ships.forEach((ship) => {
        if (board.isValidPlacement(ship.coords, ship, ship.orientation)) {
          board.placeShip(ship, ship.coords, ship.orientation);
          placed++;
        }
      });
      expect(placed).toBe(ships.length);
    });
    it("validates correct ship list 2", () => {
      const ships: (TShip & { type: "pending"; id: TCellStatusShipId })[] = [
        {
          id: 1,
          size: 3,
          type: "pending",
          placed: true,
          coords: { x: 2, y: 1 },
          orientation: "horizontal",
        },
        {
          id: 2,
          size: 3,
          type: "pending",
          placed: true,
          coords: { x: 3, y: 3 },
          orientation: "vertical",
        },
        {
          id: 3,
          size: 5,
          type: "pending",
          placed: true,
          coords: { x: 9, y: 3 },
          orientation: "vertical",
        },
        {
          id: 4,
          size: 4,
          type: "pending",
          placed: true,
          coords: { x: 7, y: 3 },
          orientation: "vertical",
        },
        {
          id: 5,
          size: 2,
          type: "pending",
          placed: true,
          coords: { x: 5, y: 3 },
          orientation: "vertical",
        },
      ];
      const board = new BattleShipsBoard(10);
      let placed = 0;
      ships.forEach((ship) => {
        if (board.isValidPlacement(ship.coords!, ship, ship.orientation!)) {
          board.placeShip(ship, ship.coords, ship.orientation);
          placed++;
        }
      });
      expect(placed).toBe(ships.length);
    });
  });
});
