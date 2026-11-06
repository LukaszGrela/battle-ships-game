import { afterEach, describe, expect, it } from "vitest";
import { EGamePhase, IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { dataTampered } from "./data_tampered";
import { createIo, createSocket } from "./__tests/utils";

const sessionService = ClientSessionServiceSingleton.getInstance();
const activeGames = ActiveGameRegistrySingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: id,
  active: true,
  ready: false,
  owner,
  seed: id === "tampered-client" ? 42 : 7,
});

const addSessionToRoom = (id: string, socketId: string, roomId: string) => {
  const session = sessionService.createSession(id, socketId);
  session.gameId = roomId;
  sessionService.updateSession(id, session);
};

describe("dataTampered", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    ["tampered-client", "missing-client", "opponent"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("emits a server error, clears the client session, and disconnects the socket", () => {
    const io = createIo();
    const socket = createSocket("tampered-client", "tampered-client-socket");
    sessionService.createSession("tampered-client", "tampered-client-socket");

    dataTampered(io, socket);

    expect(socket.emit).toHaveBeenCalledWith("error", "Internal server error");
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
    expect(sessionService.readSession("tampered-client")).toBeNull();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("forfeits a playing game and sends the finished state to both players", () => {
    const room = new WarRoom(
      "tampered-playing",
      "Playing room",
      createPlayer("tampered-client", true),
    );
    room.addPlayer(createPlayer("opponent"));
    const game = (room as any).currentGame;
    game.phase = EGamePhase.Playing;
    game.updatePlayer({ id: "tampered-client", ready: true });
    game.updatePlayer({ id: "opponent", ready: true });
    activeGames.addRoom(room.id, room);
    addSessionToRoom("tampered-client", "tampered-client-socket", room.id);
    addSessionToRoom("opponent", "opponent-socket", room.id);

    const io = createIo();
    const socket = createSocket("tampered-client", "tampered-client-socket");
    dataTampered(io, socket);

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("opponent")?.result).toEqual({
      opponent: "win",
      "tampered-client": "lost",
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Finished }),
    );
    expect(sessionService.readSession("tampered-client")).toBeNull();
  });

  it("removes a placement player and returns the opponent to waiting", () => {
    const room = new WarRoom(
      "tampered-placement",
      "Placement room",
      createPlayer("tampered-client", true),
    );
    room.addPlayer(createPlayer("opponent"));
    activeGames.addRoom(room.id, room);
    addSessionToRoom("tampered-client", "tampered-client-socket", room.id);
    addSessionToRoom("opponent", "opponent-socket", room.id);

    const io = createIo();
    const socket = createSocket("tampered-client", "tampered-client-socket");
    dataTampered(io, socket);

    expect(room.getPhase()).toBe(EGamePhase.Waiting);
    expect(room.getPlayer("tampered-client")).toBeUndefined();
    expect(room.getPlayer("opponent")?.owner).toBe(true);
    expect(io._toSpy).toHaveBeenCalledWith("player_left", {
      id: "tampered-client",
      name: "tampered-client",
      seed: 42,
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Waiting }),
    );
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
  });

  it("deletes a waiting room and releases it from the registry", () => {
    const room = new WarRoom(
      "tampered-waiting",
      "Waiting room",
      createPlayer("tampered-client", true),
    );
    activeGames.addRoom(room.id, room);
    addSessionToRoom("tampered-client", "tampered-client-socket", room.id);

    const io = createIo();
    const socket = createSocket("tampered-client", "tampered-client-socket");
    dataTampered(io, socket);

    expect(activeGames.hasRoom(room.id)).toBe(false);
    expect(io.emit).toHaveBeenCalledWith("open_games", []);
  });

  it("does not clean up a room or delete the current session for a stale socket", () => {
    const room = new WarRoom(
      "tampered-stale",
      "Waiting room",
      createPlayer("tampered-client", true),
    );
    activeGames.addRoom(room.id, room);
    addSessionToRoom("tampered-client", "current-socket", room.id);

    const io = createIo();
    const socket = createSocket("tampered-client", "stale-socket");
    dataTampered(io, socket);

    expect(activeGames.hasRoom(room.id)).toBe(true);
    expect(sessionService.readSession("tampered-client")?.socketId).toBe(
      "current-socket",
    );
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("handles a client without a session without throwing", () => {
    const io = createIo();
    const socket = createSocket("missing-client");

    expect(() => dataTampered(io, socket)).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith("error", "Internal server error");
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
