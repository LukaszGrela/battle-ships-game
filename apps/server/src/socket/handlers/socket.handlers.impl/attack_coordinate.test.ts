import { afterEach, describe, expect, it } from "vitest";
import {
  EGamePhase,
  IPlayer,
  TCellStatusShipId,
  TShip,
} from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryAttackCoordinateHandler } from "./attack_coordinate";
import { createIo, createSocket } from "./__tests/utils";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: id === "owner" ? "Captain Black" : "Captain Red",
  active: true,
  ready: false,
  owner,
  seed: id === "owner" ? 42 : 7,
});

const createFleet = (): (TShip & {
  type: "pending";
  id: TCellStatusShipId;
})[] =>
  [5, 4, 3, 3, 2].map((size, index) => ({
    id: (index + 1) as TCellStatusShipId,
    size,
    type: "pending",
    placed: true,
    coords: { x: 0, y: index * 2 },
    orientation: "horizontal",
  }));

const shipCells = [
  ...Array.from({ length: 5 }, (_, x) => ({ x, y: 0 })),
  ...Array.from({ length: 4 }, (_, x) => ({ x, y: 2 })),
  ...Array.from({ length: 3 }, (_, x) => ({ x, y: 4 })),
  ...Array.from({ length: 3 }, (_, x) => ({ x, y: 6 })),
  ...Array.from({ length: 2 }, (_, x) => ({ x, y: 8 })),
];

const createPlayingRoom = (roomId: string, firstTurn = "owner") => {
  const room = new WarRoom(roomId, "Attack Room", createPlayer("owner", true));
  room.addPlayer(createPlayer("opponent"));
  expect(room.placeShips("owner", createFleet())).toBe(true);
  expect(room.placeShips("opponent", createFleet())).toBe(true);
  if (firstTurn === "opponent") {
    room.attack("owner", { x: 9, y: 9 });
  }
  activeGames.addRoom(room.id, room);
  return room;
};

const createSessionsForRoom = (roomId: string) => {
  for (const [id, socketId] of [
    ["owner", "owner-socket"],
    ["opponent", "opponent-socket"],
  ]) {
    const session = sessionService.createSession(id!, socketId!, roomId);
    session.gameId = roomId;
    sessionService.updateSession(id!, session);
  }
};

describe("attack_coordinate handler", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("applies a valid hit, flips the turn, and emits the updated game state", () => {
    const roomId = "attack-hit";
    const room = createPlayingRoom(roomId);
    createSessionsForRoom(roomId);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();

    handler({ x: 0, y: 0 }, callback);

    expect(room.getTurn()).toBe("opponent");
    expect(room.getGameState("opponent")?.myBoard[0]?.[0]).toBe(101);

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      status: 101,
    });

    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: roomId,
        phase: EGamePhase.Playing,
      }),
    );

  });

  it("rejects an attack when it is not the player's turn", () => {
    const roomId = "attack-not-your-turn";
    createPlayingRoom(roomId, "opponent");
    createSessionsForRoom(roomId);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();
    handler({ x: 0, y: 0 }, callback);

    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      "Not your turn or game not active",
    );

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      message: "Not your turn or game not active",
    });

    expect(io._toSpy).not.toHaveBeenCalledWith(
      "game_updated",
      expect.anything(),
    );

  });

  it("finishes the match when the enemy fleet is sunk", () => {
    const roomId = "attack-finish";
    const room = createPlayingRoom(roomId);
    createSessionsForRoom(roomId);

    for (const [index, cell] of shipCells.slice(0, -1).entries()) {
      expect(room.attack("owner", cell)).toBeGreaterThan(100);
      expect(room.attack("opponent", { x: 9, y: index % 10 })).toBe(0);
    }

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();
    const finalCell = shipCells.at(-1)!;
    handler(finalCell, callback);

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      status: 1005,
      size: 2,
    });

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("owner")?.result).toEqual({ owner: "win", opponent: "lost" });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Finished,
        id: roomId,
      }),
    );

  });
});
