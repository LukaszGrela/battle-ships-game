import { createEmptyBoard, placeShip } from "@repo/game-logic";
import { ECellStatus, EGamePhase, TRoomState, TShip } from "@repo/types";
import { vi } from "vitest";

export const createSocket = (clientId: string, socketId?: string) => {
  const socket = {
    handshake: { auth: { clientId } },
    emit: vi.fn(),
    join: vi.fn(),
    disconnect: vi.fn(),
    id: socketId ?? `${clientId}-socket`,
  } as any;

  return socket;
};

export const createIo = () => {
  const toSpy = vi.fn();
  const io = {
    emit: vi.fn(),
    to: vi.fn().mockImplementation(() => ({ emit: toSpy })),
    _toSpy: toSpy,
  } as any;

  return io;
};

export const createGameRoom = (
  roomId: string,
  turn: string,
  roomName?: string,
  roomPhase: EGamePhase = EGamePhase.Waiting,
): TRoomState => ({
  id: roomId,
  name: roomName ?? roomId,
  game_created: "2026-09-25T00:00:00.000Z",
  game_started: "2026-09-25T00:01:00.000Z",
  game_finished: null,
  phase: roomPhase,
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
  battles: [],
});

export const createPlacedShip = (id: number): TShip & { type: "placed" } => ({
  id,
  size: 1,
  type: "placed",
  coords: { x: 0, y: 0 },
  orientation: "horizontal",
  hits: [],
});

export const createFinishedGameRoom = (
  roomId: string,
  winner: "owner" | "opponent",
): TRoomState => {
  const loser = winner === "owner" ? "opponent" : "owner";
  const room = createGameRoom(roomId, winner, undefined, EGamePhase.Finished);
  room.game_finished = "2026-09-25T00:02:00.000Z";
  room.result = { [winner]: "win", [loser]: "lost" };
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
      hits: [{ x: 0, y: 0 }],
    },
  ];

  room.history.push({ init: true });

  room.history.push({
    coords: { x: 0, y: 0 },
    isSunk: true,
    result: ECellStatus.Hit,
    turn: "owner",
    size: 1
  });

  room.history.push({ finish: true, whoWon: "owner" });

  return room;
};
