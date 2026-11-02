import { afterEach, describe, expect, it } from "vitest";
import { EGamePhase, IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryJoinGameHandler } from "./join_game";
import { createIo, createSocket } from "./__tests/utils";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessions = ClientSessionServiceSingleton.getInstance();
const testPlayerIds = ["owner", "opponent", "third", "missing", "busy"];

const createPlayer = (id: string, name: string): IPlayer => ({
  id,
  name,
  active: true,
  ready: false,
  seed: sessions.readSession(id)?.seed ?? 1,
});

const createWaitingRoom = (id: string, ownerId = "owner") => {
  const room = new WarRoom(
    id,
    `Room ${id}`,
    { ...createPlayer(ownerId, `Player ${ownerId}`), owner: true },
  );
  activeGames.addRoom(id, room);
  return room;
};

const cleanup = () => {
  activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  testPlayerIds.forEach((id) => sessions.deleteSession(id));
};

describe("join_game handler", () => {
  afterEach(cleanup);

  it("rejects a join when the client session is missing", () => {
    const io = createIo();
    const socket = createSocket("missing");
    const handler = factoryJoinGameHandler(io, socket);

    handler("pirate-room");

    expect(socket.emit).toHaveBeenCalledWith("error", "Invalid session");
    expect(socket.join).not.toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("creates a waiting WarRoom for a valid owner and sends the welcome game state", () => {
    sessions.createSession("owner", "owner-socket");
    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryJoinGameHandler(io, socket);

    handler("Captain Black's Room");

    const roomId = socket.join.mock.calls[0]?.[0] as string;
    const room = activeGames.getRoom(roomId);

    expect(room).toBeDefined();
    expect(room?.name).toBe("Captain Black's Room");
    expect(room?.getPhase()).toBe(EGamePhase.Waiting);
    expect(room?.getPlayer("owner")).toMatchObject({
      id: "owner",
      active: true,
      ready: false,
      owner: true,
    });
    expect(sessions.readSession("owner")?.gameId).toBe(roomId);
    expect(socket.join).toHaveBeenCalledWith(roomId);
    expect(socket.emit).toHaveBeenCalledWith("welcome", "owner");
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Waiting,
        id: roomId,
        name: "Captain Black's Room",
        self: expect.objectContaining({ id: "owner", active: true }),
      }),
    );
    expect(io.emit).toHaveBeenCalledWith(
      "open_games",
      expect.arrayContaining([
        expect.objectContaining({ id: roomId, name: "Captain Black's Room" }),
      ]),
    );
  });

  it("adds the opponent, transitions to placement, and emits opponent and game updates", () => {
    const ownerSession = sessions.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessions.updateSession("owner", ownerSession);
    const opponentSession = sessions.createSession("opponent", "opponent-socket");
    opponentSession.name = "Captain Red";
    sessions.updateSession("opponent", opponentSession);
    const room = createWaitingRoom("join-room-id");

    const io = createIo();
    const socket = createSocket("opponent", "opponent-socket");
    const handler = factoryJoinGameHandler(io, socket);

    handler({ id: room.id, name: room.name });

    expect(room.getPhase()).toBe(EGamePhase.Placement);
    expect(room.playersCount).toBe(2);
    expect(room.getPlayer("opponent")).toMatchObject({
      id: "opponent",
      name: "Captain Red",
      active: true,
      ready: false,
    });
    expect(sessions.readSession("opponent")?.gameId).toBe(room.id);
    expect(socket.join).toHaveBeenCalledWith(room.id);
    expect(socket.emit).toHaveBeenCalledWith("welcome", "opponent");
    expect(io._toSpy).toHaveBeenCalledWith(
      "opponent_connected",
      expect.objectContaining({
        name: "Captain Red",
        seed: opponentSession.seed,
        ready: false,
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Placement,
        id: room.id,
        self: expect.objectContaining({ id: "owner" }),
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Placement,
        id: room.id,
        self: expect.objectContaining({ id: "opponent", active: true }),
      }),
    );
    expect(io.emit).toHaveBeenCalledWith(
      "open_games",
      expect.not.arrayContaining([expect.objectContaining({ id: room.id })]),
    );
  });

  it("rejects joining when the player already has another active game", () => {
    sessions.createSession("owner", "owner-socket");
    sessions.createSession("opponent", "opponent-socket");
    sessions.createSession("busy", "busy-socket");
    const roomToJoin = createWaitingRoom("join-target");
    createWaitingRoom("busy-room", "busy");
    const busySession = sessions.readSession("busy")!;
    busySession.gameId = "busy-room";
    sessions.updateSession("busy", busySession);

    const io = createIo();
    const socket = createSocket("busy", "busy-socket");
    const handler = factoryJoinGameHandler(io, socket);

    handler({ id: roomToJoin.id, name: roomToJoin.name });

    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      "Failed to join room, player has another active game.",
    );
    expect(socket.join).not.toHaveBeenCalled();
    expect(roomToJoin.playersCount).toBe(1);
    expect(roomToJoin.getPhase()).toBe(EGamePhase.Waiting);
  });

  it("rejects a join when the room is already full", () => {
    sessions.createSession("owner", "owner-socket");
    sessions.createSession("opponent", "opponent-socket");
    sessions.createSession("third", "third-socket");
    const room = createWaitingRoom("join-room-full");
    expect(room.addPlayer(createPlayer("opponent", "Captain Red"))).toBe(true);
    expect(room.getPhase()).toBe(EGamePhase.Placement);

    const io = createIo();
    const socket = createSocket("third", "third-socket");
    const handler = factoryJoinGameHandler(io, socket);

    handler({ id: room.id, name: room.name });

    expect(socket.emit).toHaveBeenCalledWith("error", "Room full");
    expect(socket.join).not.toHaveBeenCalled();
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
  });
});
