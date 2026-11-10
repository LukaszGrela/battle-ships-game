import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase, IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryDisconnectHandler } from "./disconnect";
import { createIo, createSocket } from "./__tests/utils";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (
  id: string,
  name: string,
  owner = false,
  seed = id === "owner" ? 42 : 7,
): IPlayer => ({
  id,
  name,
  active: true,
  ready: false,
  owner,
  seed,
});

const createWaitingRoom = (id: string) => {
  const room = new WarRoom(id, `Room ${id}`, {
    ...createPlayer("owner", "Captain Black", true),
  });
  activeGames.addRoom(id, room);
  return room;
};

const createPlacementRoom = (id: string) => {
  const room = createWaitingRoom(id);
  room.addPlayer(createPlayer("opponent", "Captain Red"));
  return room;
};

const createPlayingRoom = (id: string) => {
  const room = createPlacementRoom(id);
  const game = (room as any).currentGame;
  game.phase = EGamePhase.Playing;
  game.updatePlayer({ id: "owner", active: true, ready: true });
  game.updatePlayer({ id: "opponent", active: true, ready: true });
  return room;
};

const attachSessionToRoom = (clientId: string, roomId: string) => {
  const session = sessionService.readSession(clientId);
  if (!session) {
    throw new Error(`Missing session for ${clientId}`);
  }
  session.gameId = roomId;
  sessionService.updateSession(clientId, session);
};

const cleanup = () => {
  activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  ["owner", "opponent", "third"].forEach((id) =>
    sessionService.deleteSession(id),
  );
};

describe("disconnect handler", () => {
  afterEach(cleanup);

  it("ignores stale socket disconnects for an active session", () => {
    const room = createWaitingRoom("stale-room");
    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "live-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    attachSessionToRoom("owner", room.id);

    const io = createIo();
    const socket = createSocket("owner", "stale-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(activeGames.hasRoom(room.id)).toBe(true);
    expect(room.getPhase()).toBe(EGamePhase.Waiting);
    expect(sessionService.readSession("owner")?.socketId).toBe("live-socket");
    expect(io.emit).not.toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("marks a player as disconnected during play without ending the room", () => {
    const room = createPlayingRoom("disconnect-playing");
    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      2,
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    attachSessionToRoom("owner", room.id);
    attachSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    const updatedSession = sessionService.readSession("owner");
    expect(updatedSession?.disconnectedAt).toBeTypeOf("number");
    expect(room.getPhase()).toBe(EGamePhase.Playing);
    expect(room.getPlayer("owner")?.active).toBe(false);
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("emits the updated room state to the remaining opponent when a player disconnects during play", () => {
    const room = createPlayingRoom("disconnect-playing-update");
    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      2,
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    attachSessionToRoom("owner", room.id);
    attachSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Playing,
        id: room.id,
        self: expect.objectContaining({ id: "opponent" }),
      }),
    );
    expect(room.getPlayer("owner")?.active).toBe(false);
  });

  it("tears down a placement room when the last remaining player disconnects", () => {
    const room = createWaitingRoom("disconnect-one-player");
    room.addPlayer(createPlayer("opponent", "Captain Red"));
    room.removePlayer("opponent");

    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    attachSessionToRoom("owner", room.id);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(activeGames.hasRoom(room.id)).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });

  it("moves a placement room back to waiting when one player disconnects", () => {
    const room = createPlacementRoom("disconnect-placement");
    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      2,
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    attachSessionToRoom("owner", room.id);
    attachSessionToRoom("opponent", room.id);

    const toSpy = vi.fn();
    const socketEmitter = { emit: vi.fn() };
    const io = {
      emit: vi.fn(),
      to: toSpy.mockReturnValue(socketEmitter),
    } as any;

    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(room.getPhase()).toBe(EGamePhase.Waiting);
    expect(room.getPlayer("owner")).toBeUndefined();
    expect(room.getPlayer("opponent")?.owner).toBe(true);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
    expect(toSpy).toHaveBeenCalledWith("opponent-socket");
    expect(socketEmitter.emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Waiting }),
    );
  });

  it("tears down a waiting room when the owner disconnects", () => {
    const room = createWaitingRoom("disconnect-waiting");
    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    attachSessionToRoom("owner", room.id);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryDisconnectHandler(io, socket);

    handler("transport close");

    expect(activeGames.hasRoom(room.id)).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(io.emit).toHaveBeenCalledWith("server_stats", expect.any(Object));
  });
});
