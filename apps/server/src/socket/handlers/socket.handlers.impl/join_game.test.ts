import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import {
  createWarRoom,
  transitionToPlacement,
} from "../../../utils/gameLifeCycle";
import { factoryJoinGameHandler } from "./join_game";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const cleanup = (...roomIds: string[]) => {
  roomIds.forEach((roomId) => roomService.deleteRoom(roomId));
  ["owner", "opponent", "third", "missing", "new-owner"].forEach((id) =>
    sessionService.deleteSession(id),
  );
};

const createSocket = (clientId: string) => {
  const socket = {
    handshake: {
      auth: { clientId },
    },
    join: vi.fn(),
    emit: vi.fn(),
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

describe("join_game handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent", "third", "missing", "new-owner"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("rejects a join when the client session is missing", () => {
    const io = createIo();
    const socket = createSocket("missing");
    const handler = factoryJoinGameHandler(io, socket);

    handler("pirate-room");

    expect(socket.emit).toHaveBeenCalledWith("error", "Invalid session");
    expect(io.emit).not.toHaveBeenCalledWith("open_games", expect.anything());
  });

  it("creates a waiting room for a valid owner and emits the welcome/game state", () => {
    sessionService.createSession("owner", "owner-socket");
    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryJoinGameHandler(io, socket);

    handler("Captain Black's Room");

    const roomId = socket.join.mock.calls[0][0];
    const room = roomService.getRoom(roomId);

    expect(room).toEqual(
      expect.objectContaining({
        id: roomId,
        name: "Captain Black's Room",
        phase: EGamePhase.Waiting,
      }),
    );
    expect(socket.join).toHaveBeenCalledWith(roomId);
    expect(socket.emit).toHaveBeenCalledWith("welcome", "owner");
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Waiting,
        id: roomId,
      }),
    );
    expect(io.emit).toHaveBeenCalledWith(
      "open_games",
      expect.arrayContaining([
        expect.objectContaining({ id: roomId, name: "Captain Black's Room" }),
      ]),
    );

    cleanup(roomId);
  });

  it("moves a waiting room into placement and notifies the opponent", () => {
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
      { id: "join-room-id", name: "Pirate Cove" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("opponent");
    const handler = factoryJoinGameHandler(io, socket);

    handler({ id: room!.id, name: room!.name });

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Placement);
    expect(updatedRoom.players).toEqual(
      expect.objectContaining({
        owner: expect.objectContaining({ id: "owner" }),
        opponent: expect.objectContaining({ id: "opponent" }),
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith("opponent_connected", {
      name: "Captain Red",
      owner: undefined,
      seed: 1136367460,
      ready: false,
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Placement,
        id: room!.id,
      }),
    );

    cleanup(room!.id);
  });

  it("rejects a join when the room is already full", () => {
    const owner = sessionService.createSession("owner", "owner-socket");
    owner.name = "Captain Black";
    sessionService.updateSession("owner", owner);
    const opponent = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponent.name = "Captain Red";
    sessionService.updateSession("opponent", opponent);
    const room = createWarRoom(
      { id: "join-room-full", name: "Full Room" },
      "owner",
    );
    expect(room).toBeDefined();
    const placementRoom = transitionToPlacement(room!.id, "opponent");
    expect(placementRoom).toBeDefined();

    const io = createIo();
    const socket = createSocket("third");
    const handler = factoryJoinGameHandler(io, socket);

    sessionService.createSession("third", "third-socket");
    handler({ id: room!.id, name: room!.name });

    expect(socket.emit).toHaveBeenCalledWith("error", "Room full");
    expect(socket.join).not.toHaveBeenCalled();

    cleanup(room!.id);
  });
});
