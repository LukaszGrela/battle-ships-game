import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TGameServer } from "@repo/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ActiveGameRegistrySingleton from "../active-game-registry";
import ClientSessionServiceSingleton from "../client-session.service";
import GameStatsServiceSingleton from "../game-stats.service";
import { WarRoom } from "../WarRoom";
import { warRoomNames } from "../WarRoomName.service";
import {
  disposeRestartGrace,
  getReconnectTimeoutMs,
  getRestartGraceDeadline,
} from "../../utils/reconnectGrace";
import { FileStateStore } from "./FileStateStore";
import { collectStateSnapshot } from "./snapshot";
import { StateService } from "./state.service";

/**
 * Rooms and sessions broadcast to sockets; the restore path only needs
 * `emit`/`to`/`in` to exist, so an inert stub keeps the test offline.
 */
const ioStub = new Proxy(function () {}, {
  get: (_target, property) => {
    if (property === "sockets") {
      return { sockets: new Map(), adapter: { rooms: new Map() } };
    }
    if (property === "then") return undefined;
    return ioStub;
  },
  apply: () => ioStub,
}) as unknown as TGameServer;

const createPlayer = (id: string, owner = false) => ({
  id,
  name: `${id}-name`,
  seed: id.length * 10,
  active: true,
  ready: false,
  owner,
});

const createFleet = () =>
  [5, 4, 3, 3, 2].map((size, index) => ({
    id: index + 1,
    size,
    type: "pending",
    placed: true,
    coords: { x: 0, y: index * 2 },
    orientation: "horizontal",
  }));

const registry = ActiveGameRegistrySingleton.getInstance();
const sessions = ClientSessionServiceSingleton.getInstance();
const stats = GameStatsServiceSingleton.getInstance();

const clearRuntimeState = () => {
  registry.listRooms().forEach(({ id }) => registry.deleteRoom(id));
  sessions.listSessions().forEach(({ id }) => sessions.deleteSession(id));
  stats.reset();
  warRoomNames.listClaimed().forEach((name) => warRoomNames.releaseRoom(name));
};

describe("services/state restore", () => {
  let dir: string;

  beforeEach(async () => {
    clearRuntimeState();
    disposeRestartGrace();
    dir = await mkdtemp(path.join(tmpdir(), "battle-ships-restore-"));
  });

  afterEach(async () => {
    clearRuntimeState();
    disposeRestartGrace();
    await rm(dir, { recursive: true, force: true });
  });

  const createStartedRoom = (id: string, name: string, ownerId: string) => {
    const room = new WarRoom(id, name, createPlayer(ownerId, true));
    room.addPlayer(createPlayer("opponent"));
    room.placeShips(ownerId, createFleet());
    room.placeShips("opponent", createFleet());
    registry.addRoom(room.id, room);
    return room;
  };

  const createFinishedRoom = (id: string, name: string) => {
    const room = new WarRoom(id, name, createPlayer("p1", true));
    room.addPlayer(createPlayer("p2"));
    room.placeShips("p1", createFleet());
    room.placeShips("p2", createFleet());
    room.forfeit("p1");
    registry.addRoom(room.id, room);
    return room;
  };

  it("restores rooms, sessions, stats and claimed names", async () => {
    createStartedRoom("room-live", "Czarna Perla", "owner");
    createFinishedRoom("room-done", "Latajacy Holender");

    sessions.createSession("owner", 11, "sock-owner", "room-live");
    sessions.createSession("p1", 12, "sock-p1", "room-done");
    stats.recordGame({
      id: "room-live#0",
      roomId: "room-live",
      roomName: "Czarna Perla",
      battleIndex: 0,
      finishedAt: new Date().toISOString(),
      byForfeit: false,
      players: [
        { id: "owner", name: "owner-name", won: true },
        { id: "opponent", name: "opponent-name", won: false },
      ],
      meta: {},
    } as never);

    const service = new StateService({ dir });
    await service.save();
    clearRuntimeState();

    const report = await service.restore(ioStub);

    expect(report.restored).toBe(true);
    expect(report.rooms).toHaveLength(2);
    expect(report.closedRooms).toEqual([]);
    expect(report.sessions).toBe(2);

    expect(registry.getRoom("room-live")?.getPhase()).toBe("playing");
    expect(registry.getRoom("room-done")?.getPhase()).toBe("finished");
    expect(sessions.readSession("owner")?.gameId).toBe("room-live");
    expect(stats.allGames()).toHaveLength(1);
    expect(warRoomNames.listClaimed()).toEqual(
      expect.arrayContaining(["Czarna Perla", "Latajacy Holender"]),
    );
  });

  it("resets the rematch state of a restored finished room", async () => {
    const room = createFinishedRoom("room-done", "Latajacy Holender");
    sessions.createSession("p1", 12, "sock-p1", "room-done");
    // The loser asks for a rematch, then the process restarts.
    room.requestRematch("p2");
    expect(room.getGameState("p2")?.rematchRequest?.status).toBe("pending");

    const service = new StateService({ dir });
    await service.save();
    clearRuntimeState();
    await service.restore(ioStub);

    const restored = registry.getRoom("room-done");
    expect(restored?.getGameState("p2")?.rematchRequest ?? null).toBeNull();
  });

  it("opens the 90 s reconnect window after a restore", async () => {
    createStartedRoom("room-live", "Czarna Perla", "owner");
    sessions.createSession("owner", 11, "sock-owner", "room-live");

    const service = new StateService({ dir });
    await service.save();
    clearRuntimeState();
    await service.restore(ioStub);

    expect(getReconnectTimeoutMs()).toBeLessThanOrEqual(90_000);
    expect(getReconnectTimeoutMs()).toBeGreaterThan(89_000);
    const deadline = getRestartGraceDeadline();
    expect(deadline).toBeGreaterThan(Date.now() + 80_000);
  });

  it("drops a room that cannot be deserialized and keeps the rest", async () => {
    createStartedRoom("room-live", "Czarna Perla", "owner");
    sessions.createSession("owner", 11, "sock-owner", "room-live");

    const snapshot = collectStateSnapshot();
    const broken = {
      ...snapshot,
      rooms: [
        ...snapshot.rooms,
        {
          id: "room-broken",
          name: "Rozbity",
          phase: "playing",
          data: "{not-json",
        },
      ],
    };

    await new FileStateStore({ dir }).save(broken);
    clearRuntimeState();

    const service = new StateService({ dir });
    const report = await service.restore(ioStub);

    expect(report.restored).toBe(true);
    expect(report.rooms.map((room) => room.id)).toEqual(["room-live"]);
    expect(report.closedRooms).toEqual([
      {
        id: "room-broken",
        name: "Rozbity",
        reason: "restore-deserialize-error",
      },
    ]);
  });

  it("starts empty when there is no snapshot on disk", async () => {
    const service = new StateService({ dir });

    const report = await service.restore(ioStub);

    expect(report.restored).toBe(false);
    expect(report.rooms).toEqual([]);
    expect(registry.listRooms()).toEqual([]);
  });
});
