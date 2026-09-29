import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase } from "@repo/types";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import RoomServiceSingleton from "../../../services/room.service";
import {
  createWarRoom,
  transitionToPlacement,
  transitionToPlaying,
} from "../../../utils/gameLifeCycle";
import { factoryDisconnectHandler } from "./disconnect";
import { createIo, createSocket } from "./__tests/utils";

const sessionService = ClientSessionServiceSingleton.getInstance();
const roomService = RoomServiceSingleton.getInstance();

describe("disconnect handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent", "third"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("ignores stale socket disconnects for an active session", () => {
    const ownerSession = sessionService.createSession("owner", "live-socket");
    ownerSession.gameId = "stale-room";
    sessionService.updateSession("owner", ownerSession);

    const room = createWarRoom(
      { id: "stale-room", name: "Stale Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner", "stale-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(roomService.getRoom("stale-room")?.phase).toBe(EGamePhase.Waiting);
    expect(sessionService.readSession("owner")?.socketId).toBe("live-socket");
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("marks a player as disconnected during play without ending the room", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    ownerSession.name = "Captain Black";
    opponentSession.name = "Captain Red";
    sessionService.updateSession("owner", ownerSession);
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "disconnect-playing", name: "Playing Room" },
      "owner",
    );
    expect(room).toBeDefined();
    transitionToPlacement(room!.id, "opponent");

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
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    const updatedSession = sessionService.readSession("owner");
    expect(updatedSession?.disconnectedAt).toBeTypeOf("number");
    expect(roomService.getRoom(room!.id)?.phase).toBe(EGamePhase.Playing);
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("tears down a placement room when the last remaining player disconnects", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    ownerSession.name = "Captain Black";
    opponentSession.name = "Captain Red";
    sessionService.updateSession("owner", ownerSession);
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "disconnect-one-player", name: "Single Player Room" },
      "owner",
    );
    expect(room).toBeDefined();
    transitionToPlacement(room!.id, "opponent");

    const roomState = roomService.getRoom(room!.id)!;
    delete roomState.players.opponent;
    delete roomState.boards.opponent;
    roomService.saveRoom(roomState);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(roomService.hasRoom(room!.id)).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("moves a placement room back to waiting when one player disconnects", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    ownerSession.name = "Captain Black";
    opponentSession.name = "Captain Red";
    sessionService.updateSession("owner", ownerSession);
    sessionService.updateSession("opponent", opponentSession);

    const room = createWarRoom(
      { id: "disconnect-placement", name: "Placement Room" },
      "owner",
    );
    expect(room).toBeDefined();
    transitionToPlacement(room!.id, "opponent");

    const toSpy = vi.fn();
    const socketEmitter = { emit: vi.fn() };
    const io = {
      emit: vi.fn(),
      to: toSpy.mockReturnValue(socketEmitter),
    } as any;

    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    const updatedRoom = roomService.getRoom(room!.id)!;
    expect(updatedRoom.phase).toBe(EGamePhase.Waiting);
    expect(updatedRoom.players).not.toHaveProperty("owner");
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(updatedRoom.players.opponent).toBeDefined();
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));

    expect(toSpy).toHaveBeenCalledWith("opponent-socket");
    expect(socketEmitter.emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Waiting }),
    );
  });

  it("tears down a waiting room when the owner disconnects", () => {
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);

    const room = createWarRoom(
      { id: "disconnect-waiting", name: "Waiting Room" },
      "owner",
    );
    expect(room).toBeDefined();

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(roomService.hasRoom(room!.id)).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });
});
