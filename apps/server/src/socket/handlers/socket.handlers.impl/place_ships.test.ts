import { afterEach, describe, expect, it, vi } from "vitest";
import { ECellStatus, EGamePhase, TShip } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { createWarRoom } from "../../../utils/gameLifeCycle";
import { factoryPlaceShipsHandler } from "./place_ships";
import { createIo, createSocket } from "./__tests/utils";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createValidShips = (): (TShip & { type: "pending" })[] => [
  {
    id: 0,
    size: 5,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 0 },
    orientation: "horizontal",
  },
  {
    id: 1,
    size: 4,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 1 },
    orientation: "horizontal",
  },
  {
    id: 2,
    size: 3,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 2 },
    orientation: "horizontal",
  },
  {
    id: 3,
    size: 3,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 3 },
    orientation: "horizontal",
  },
  {
    id: 4,
    size: 2,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 4 },
    orientation: "horizontal",
  },
];

const createBoardWithOpenCells = () =>
  Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ECellStatus.Empty),
  );

describe("place_ships handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent", "third"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("marks a player ready and stores only valid placed ships when the opponent is not ready yet", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "place-room-ready", name: "Ready Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    const roomWithOpponent = roomService.getRoom(room!.id)!;
    roomWithOpponent.players.opponent = {
      id: "opponent",
      name: "Captain Red",
      seed: 42,
      active: true,
      ready: false,
      owner: false,
    };
    roomWithOpponent.boards.opponent = createBoardWithOpenCells();
    roomWithOpponent.boards.owner = createBoardWithOpenCells();
    roomWithOpponent.phase = EGamePhase.Placement;
    roomWithOpponent.ships.owner = roomWithOpponent.ships.owner ?? [
      { id: 0, size: 5, type: "pending", placed: false },
      { id: 1, size: 4, type: "pending", placed: false },
      { id: 2, size: 3, type: "pending", placed: false },
      { id: 3, size: 3, type: "pending", placed: false },
      { id: 4, size: 2, type: "pending", placed: false },
    ];
    roomWithOpponent.ships.opponent = roomWithOpponent.ships.opponent ?? [
      { id: 0, size: 5, type: "pending", placed: false },
      { id: 1, size: 4, type: "pending", placed: false },
      { id: 2, size: 3, type: "pending", placed: false },
      { id: 3, size: 3, type: "pending", placed: false },
      { id: 4, size: 2, type: "pending", placed: false },
    ];
    roomService.saveRoom(roomWithOpponent);

    const payload = createValidShips();
    handler(payload);

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Placement);
    expect(updatedRoom.players.owner?.ready).toBe(true);
    expect(updatedRoom.ships.owner).toHaveLength(5);
    expect(
      updatedRoom.ships.owner?.every((ship) => ship.type === "placed"),
    ).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Placement,
        id: room!.id,
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith(
      "player_ready",
      expect.objectContaining({
        name: "Captain Black",
        ready: true,
      }),
    );
  });

  it("writes each placed ship onto the board at its coordinates", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "place-room-board-check", name: "Board Check Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    const roomWithOpponent = roomService.getRoom(room!.id)!;
    roomWithOpponent.players.opponent = {
      id: "opponent",
      name: "Captain Red",
      seed: 42,
      active: true,
      ready: false,
      owner: false,
    };
    roomWithOpponent.boards.opponent = createBoardWithOpenCells();
    roomWithOpponent.boards.owner = createBoardWithOpenCells();
    roomWithOpponent.phase = EGamePhase.Placement;
    roomWithOpponent.ships.owner = [
      { id: 0, size: 2, type: "pending", placed: false },
    ];
    roomWithOpponent.ships.opponent = [
      { id: 0, size: 2, type: "pending", placed: false },
    ];
    roomService.saveRoom(roomWithOpponent);

    handler([
      {
        id: 0,
        size: 2,
        type: "pending",
        placed: false,
        coords: { x: 1, y: 1 },
        orientation: "vertical",
      },
    ]);

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.boards?.owner?.[1]?.[1]).toBe(0);
    expect(updatedRoom.boards?.owner?.[2]?.[1]).toBe(0);
    expect(updatedRoom.boards?.owner?.[1]?.[1]).not.toBe(ECellStatus.Empty);
    expect(updatedRoom.boards?.owner?.[2]?.[1]).not.toBe(ECellStatus.Empty);
  });

  it("transitions to playing when both players are already ready and broadcasts the game state to both sockets", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "place-room-playing", name: "Battle Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    const roomWithOpponent = roomService.getRoom(room!.id)!;
    roomWithOpponent.players.opponent = {
      id: "opponent",
      name: "Captain Red",
      seed: 42,
      active: true,
      ready: true,
      owner: false,
    };
    roomWithOpponent.boards.opponent = createBoardWithOpenCells();
    roomWithOpponent.boards.owner = createBoardWithOpenCells();
    roomWithOpponent.phase = EGamePhase.Placement;
    roomWithOpponent.ships.owner = [
      { id: 0, size: 5, type: "pending", placed: false },
      { id: 1, size: 4, type: "pending", placed: false },
      { id: 2, size: 3, type: "pending", placed: false },
      { id: 3, size: 3, type: "pending", placed: false },
      { id: 4, size: 2, type: "pending", placed: false },
    ];
    roomWithOpponent.ships.opponent = [
      { id: 0, size: 5, type: "pending", placed: false },
      { id: 1, size: 4, type: "pending", placed: false },
      { id: 2, size: 3, type: "pending", placed: false },
      { id: 3, size: 3, type: "pending", placed: false },
      { id: 4, size: 2, type: "pending", placed: false },
    ];
    roomService.saveRoom(roomWithOpponent);

    handler(createValidShips());

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Playing);
    expect(updatedRoom.game_started).not.toBeNull();
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Playing,
        id: room!.id,
      }),
    );
  });
});
