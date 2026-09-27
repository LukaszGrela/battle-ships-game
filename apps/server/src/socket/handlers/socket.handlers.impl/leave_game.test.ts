import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import {
  createWarRoom,
  transitionToFinished,
  transitionToPlacement,
  transitionToPlaying,
} from "../../../utils/gameLifeCycle";
import { factoryLeaveGameHandler } from "./leave_game";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createSocket = (clientId: string) => {
  const socket = {
    handshake: { auth: { clientId } },
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

const cleanup = (...roomIds: string[]) => {
  roomIds.forEach((roomId) => roomService.deleteRoom(roomId));
  ["owner", "opponent", "third"].forEach((id) =>
    sessionService.deleteSession(id),
  );
};

describe("leave_game handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent", "third"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("destroys a waiting room and clears the owner session when the player leaves early", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);

    const room = createWarRoom(
      { id: "leave-waiting", name: "Waiting Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(roomService.hasRoom("leave-waiting")).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));

    cleanup("leave-waiting");
  });

  it("moves a placement room back to waiting when the player leaves", () => {
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
      { id: "leave-placement", name: "Placement Room" },
      "owner",
    );
    expect(room).toBeDefined();
    const placementRoom = transitionToPlacement(room!.id, "opponent");
    expect(placementRoom).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Waiting);
    expect(updatedRoom.players).not.toHaveProperty("owner");
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);

    cleanup(room!.id);
  });

  it("forfeits the game when a player leaves during play", () => {
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
      { id: "leave-playing", name: "Playing Room" },
      "owner",
    );
    expect(room).toBeDefined();
    const placementRoom = transitionToPlacement(room!.id, "opponent");
    expect(placementRoom).toBeDefined();

    const roomState = roomService.getRoom(room!.id)!;
    if (roomState.players.opponent) {
      roomState.players.opponent.ready = true;
    }
    roomService.saveRoom(roomState);

    const playingRoom = transitionToPlaying(room!.id, "owner", [
      {
        id: 1,
        size: 2,
        type: "placed",
        coords: { x: 0, y: 0 },
        orientation: "horizontal",
        hits: [],
      },
    ]);
    expect(playingRoom).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    const finishedRoom = roomService.getRoom(room!.id)!;
    expect(finishedRoom.phase).toBe(EGamePhase.Finished);
    expect(finishedRoom.result).toEqual({ owner: "lost", opponent: "win" });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Finished, id: room!.id }),
    );

    cleanup(room!.id);
  });

  it("does nothing when the player already left a finished game", () => {
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
      { id: "leave-finished", name: "Finished Room" },
      "owner",
    );
    expect(room).toBeDefined();
    const placementRoom = transitionToPlacement(room!.id, "opponent");
    expect(placementRoom).toBeDefined();

    const roomState = roomService.getRoom(room!.id)!;
    if (roomState.players.opponent) {
      roomState.players.opponent.ready = true;
    }
    if (roomState.players.owner) {
      roomState.players.owner.ready = true;
    }
    roomState.phase = EGamePhase.Playing;
    roomService.saveRoom(roomState);

    const finishedRoom = transitionToFinished(room!.id, "owner");
    expect(finishedRoom).toBeDefined();
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(sessionService.readSession("opponent")?.gameId).toBeUndefined();

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(roomService.getRoom(room!.id)?.phase).toBe(EGamePhase.Finished);
    expect(socket.emit).not.toHaveBeenCalledWith(
      "game_updated",
      expect.anything(),
    );
    expect(io.emit).not.toHaveBeenCalledWith("open_games", expect.anything());

    cleanup(room!.id);
  });
});
