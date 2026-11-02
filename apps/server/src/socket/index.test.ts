import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EGamePhase, IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import ClientSessionServiceSingleton from "../services/client-session.service";
import ActiveUsersServiceSingleton from "../services/users.service";
import { WarRoom } from "../services/WarRoom";
import { factoryConnectHandler } from "./index";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import { registerServerHandlers } from "./handlers/server.handlers";

vi.mock("./handlers/room.handlers", () => ({
  registerRoomHandlers: vi.fn(),
}));

vi.mock("./handlers/game.handlers", () => ({
  registerGameHandlers: vi.fn(),
}));

vi.mock("./handlers/server.handlers", () => ({
  registerServerHandlers: vi.fn(),
}));

vi.mock("../utils/emitStats", () => ({
  emitStats: vi.fn(),
}));

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessions = ClientSessionServiceSingleton.getInstance();
const activeUsers = ActiveUsersServiceSingleton.getInstance();

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

const cleanup = () => {
  activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  sessions.listSessions().forEach(({ id }) => sessions.deleteSession(id));

  activeUsers.forEach((userId: string) => {
    activeUsers.removeUser(userId);
  });
};

describe("factoryConnectHandler", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("disconnects invalid connections without registering handlers", () => {
    const io = { emit: vi.fn() } as any;
    const socket = {
      handshake: { auth: {} },
      disconnect: vi.fn(),
      emit: vi.fn(),
    } as any;

    factoryConnectHandler(io)(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(registerRoomHandlers).not.toHaveBeenCalled();
    expect(registerGameHandlers).not.toHaveBeenCalled();
    expect(registerServerHandlers).not.toHaveBeenCalled();
  });

  it("creates a session and emits lobby state for a fresh connection", () => {
    const io = { emit: vi.fn() } as any;
    const socket = {
      id: "new-socket",
      handshake: { auth: { clientId: "new-player" } },
      emit: vi.fn(),
      disconnect: vi.fn(),
    } as any;

    factoryConnectHandler(io)(socket);

    expect(registerRoomHandlers).toHaveBeenCalledWith(io, socket);
    expect(registerGameHandlers).toHaveBeenCalledWith(io, socket);
    expect(registerServerHandlers).toHaveBeenCalledWith(io, socket);
    expect(socket.emit).toHaveBeenCalledWith(
      "session_created",
      expect.objectContaining({ id: "new-player", socketId: "new-socket" }),
    );
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
  });

  it("restores an existing session and reactivates an active game", () => {
    const room = new WarRoom("room-1", "Room 1", {
      ...createPlayer("owner", "Captain Black", true),
    });
    activeGames.addRoom(room.id, room);

    const session = sessions.createSession("owner", "stale-socket");
    session.name = "Captain Black";
    session.gameId = room.id;
    sessions.updateSession("owner", session);

    const io = {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as any;
    const socket = {
      id: "live-socket",
      handshake: { auth: { clientId: "owner" } },
      emit: vi.fn(),
      disconnect: vi.fn(),
    } as any;

    factoryConnectHandler(io)(socket);

    expect(socket.emit).toHaveBeenCalledWith(
      "session_restored",
      expect.objectContaining({ id: "owner", socketId: "live-socket" }),
    );
    expect(socket.emit).toHaveBeenCalledWith("welcome", "owner");
    expect(socket.emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ id: room.id, phase: EGamePhase.Waiting }),
    );
  });
});
