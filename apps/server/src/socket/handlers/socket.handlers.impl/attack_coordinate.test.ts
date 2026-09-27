import { afterEach, describe, expect, it, vi } from "vitest";
import { ECellStatus, EGamePhase, TRoomState, TShip } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { factoryAttackCoordinateHandler } from "./attack_coordinate";
import { placeShip } from "@repo/game-logic";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createEmptyBoard = () =>
  Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ECellStatus.Empty),
  );

const createSocket = (clientId: string) => {
  const socket = {
    handshake: { auth: { clientId } },
    emit: vi.fn(),
    disconnect: vi.fn(),
    id: `${clientId}-socket`,
  } as any;

  return socket;
};

const createIo = () => {
  const toSpy = vi.fn();
  const io = {
    emit: vi.fn(),
    to: vi.fn().mockImplementation(() => ({ emit: toSpy })),
    _toSpy: toSpy,
  } as any;

  return io;
};

const createGameRoom = (roomId: string, turn: string): TRoomState => ({
  id: roomId,
  name: "Attack Room",
  game_created: "2026-09-25T00:00:00.000Z",
  game_started: "2026-09-25T00:01:00.000Z",
  game_finished: null,
  phase: EGamePhase.Playing,
  players: {
    owner: {
      id: "owner",
      name: "Captain Black",
      active: true,
      ready: true,
      seed: 42,
      owner: true,
    },
    opponent: {
      id: "opponent",
      name: "Captain Red",
      active: true,
      ready: true,
      seed: 7,
      owner: false,
    },
  },
  boards: {
    owner: createEmptyBoard(),
    opponent: createEmptyBoard(),
  },
  ships: {
    owner: [
      {
        id: 1,
        size: 2,
        type: "placed",
        coords: { x: 0, y: 0 },
        orientation: "horizontal",
        hits: [],
      },
    ],
    opponent: [
      {
        id: 9,
        size: 2,
        type: "placed",
        coords: { x: 2, y: 3 },
        orientation: "horizontal",
        hits: [],
      },
    ],
  },
  turn,
  result: {},
  history: [],
});

const cleanup = (...roomIds: string[]) => {
  roomIds.forEach((roomId) => roomService.deleteRoom(roomId));
  ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
};

const createPlacedShip = (id: number): TShip & { type: "placed" } => ({
  id,
  size: 1,
  type: "placed",
  coords: { x: 0, y: 0 },
  orientation: "horizontal",
  hits: [],
});

describe("attack_coordinate handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("applies a valid hit, flips the turn, and emits the updated game state", () => {
    const roomId = "attack-hit";
    const room = createGameRoom(roomId, "owner")!;

    placeShip(
      room.boards.opponent!,
      { x: 2, y: 3 },
      createPlacedShip(9),
      "horizontal",
    );

    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    handler({ x: 2, y: 3 });

    const updatedRoom = roomService.getRoom(roomId)!;
    expect(updatedRoom.turn).toBe("opponent");
    expect(updatedRoom.boards.opponent?.[3]?.[2]).toBe(ECellStatus.Hit);
    expect(updatedRoom.history.at(-1)).toMatchObject({
      turn: "owner",
      result: ECellStatus.Hit,
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: roomId,
        phase: EGamePhase.Playing,
      }),
    );

    cleanup(roomId);
  });

  it("rejects an attack when it is not the player's turn", () => {
    const roomId = "attack-not-your-turn";
    const room = createGameRoom(roomId, "opponent");
    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    handler({ x: 0, y: 0 });

    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      "Not your turn or game not active",
    );
    expect(io._toSpy).not.toHaveBeenCalledWith(
      "game_updated",
      expect.anything(),
    );

    cleanup(roomId);
  });

  it("finishes the match when the enemy fleet is sunk", () => {
    const roomId = "attack-finish";
    const room = createGameRoom(roomId, "owner");

    placeShip(
      room.boards.opponent!,
      { x: 0, y: 0 },
      createPlacedShip(9),
      "horizontal",
    );

    room.ships.opponent = [
      {
        id: 9,
        size: 1,
        type: "placed",
        coords: { x: 0, y: 0 },
        orientation: "horizontal",
        hits: [],
      },
    ];
    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    handler({ x: 0, y: 0 });

    const updatedRoom = roomService.getRoom(roomId)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Finished);
    expect(updatedRoom.result).toEqual({ owner: "win", opponent: "lost" });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Finished,
        id: roomId,
      }),
    );

    cleanup(roomId);
  });
});
