import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase, IPlayer, TCellStatusShipId, TShip } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import BotRunnerService from "../../../services/bot-runner";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { createIo, createSocket } from "./__tests/utils";
import {
  factoryAcceptRematchHandler,
  factoryCancelRematchHandler,
  factoryRejectRematchHandler,
  factoryRequestRematchHandler,
} from "./rematch";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: `${id}-name`,
  seed: id.length * 10,
  active: true,
  ready: false,
  owner,
});

const createFleet = (): (TShip & {
  type: "pending";
  id: TCellStatusShipId;
})[] =>
  [5, 4, 3, 3, 2].map((size, index) => ({
    id: (index + 1) as TCellStatusShipId,
    size,
    type: "pending",
    placed: true,
    coords: { x: 0, y: index * 2 },
    orientation: "horizontal",
  }));

const createFinishedWarRoom = (roomId: string) => {
  const room = new WarRoom(
    roomId,
    `${roomId}-name`,
    createPlayer("owner", true),
  );
  room.addPlayer(createPlayer("opponent"));
  expect(room.placeShips("owner", createFleet())).toBe(true);
  expect(room.placeShips("opponent", createFleet())).toBe(true);
  expect(room.forfeit("owner")).toBe(true);
  expect(room.getPhase()).toBe(EGamePhase.Finished);
  activeGames.addRoom(room.id, room);
  return room;
};

const createFinishedWarRoomWithBot = (roomId: string) => {
  const room = new WarRoom(roomId, `${roomId}-name`, createPlayer("owner", true));
  room.addPlayer({ ...createPlayer("bot-1"), botLevel: "hard" as const });
  expect(room.placeShips("owner", createFleet())).toBe(true);
  expect(room.placeShips("bot-1", createFleet())).toBe(true);
  expect(room.forfeit("owner")).toBe(true);
  expect(room.getPhase()).toBe(EGamePhase.Finished);
  activeGames.addRoom(room.id, room);
  return room;
};

const createSessions = () => {
  sessionService.createSession("owner", 1, "owner-socket");
  sessionService.createSession("opponent", 2, "opponent-socket");
};

vi.mock("../../../utils/createId", () => ({
  createId: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

describe("rematch handlers", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("handles a rematch request and notifies the other player", () => {
    const room = createFinishedWarRoom("rematch-requested-room");
    createSessions();

    const io = createIo();
    const socket = createSocket("opponent");
    factoryRequestRematchHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("opponent")?.rematchRequest).toEqual({
      requestId: "00000000-0000-4000-8000-000000000001",
      requestorId: "opponent",
      status: "pending",
      name: "opponent-name",
      seed: 80,
      expiresAt: expect.any(String),
    });
    expect(socket.emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: room.id,
        phase: EGamePhase.Finished,
        rematchRequest: expect.objectContaining({
          requestorId: "opponent",
          status: "pending",
        }),
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith("rematch_requested", {
      requestId: "00000000-0000-4000-8000-000000000001",
      requestorId: "opponent",
      status: "pending",
      name: "opponent-name",
      seed: 80,
      expiresAt: expect.any(String),
    });
  });

  it("wakes the bot for a rematch request even without a client session", () => {
    const room = createFinishedWarRoomWithBot("rematch-bot-room");
    sessionService.createSession("owner", 1, "owner-socket");

    const wakeBot = vi.spyOn(
      BotRunnerService.getInstance(),
      "onRoomStateChanged",
    );
    const io = createIo();
    factoryRequestRematchHandler(io, createSocket("owner"))();

    expect(room.getGameState("owner")?.rematchRequest).toMatchObject({
      requestorId: "owner",
      status: "pending",
    });
    // Regression: the bot has no ClientSession, so the old session-gated branch
    // never broadcast the room state and the parked bot never answered.
    expect(wakeBot).toHaveBeenCalledWith(room.id);
    expect(io._toSpy).not.toHaveBeenCalledWith(
      "rematch_requested",
      expect.anything(),
    );
    wakeBot.mockRestore();
  });

  it("accepts a rematch, resets the game, updates sessions, and emits state", () => {
    const room = createFinishedWarRoom("rematch-accepted-room");
    createSessions();
    expect(room.requestRematch("opponent")).toBe(1);

    const io = createIo();
    const socket = createSocket("owner");
    factoryAcceptRematchHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Placement);
    expect(room.battlesPlayed).toBe(1);
    expect(room.getPlayer("owner")).toMatchObject({
      ready: false,
      owner: true,
    });
    expect(room.getPlayer("opponent")?.ready).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBe(room.id);
    expect(sessionService.readSession("opponent")?.gameId).toBe(room.id);
    expect(io._toSpy).toHaveBeenCalledWith("rematch_accepted", {
      roomId: room.id,
      status: "accepted",
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ id: room.id, phase: EGamePhase.Placement }),
    );
  });

  it("cancels a pending rematch and notifies both players", () => {
    const room = createFinishedWarRoom("rematch-cancelled-room");
    createSessions();
    expect(room.requestRematch("opponent")).toBe(1);

    const io = createIo();
    const socket = createSocket("opponent");
    factoryCancelRematchHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("owner")?.rematchRequest).toMatchObject({
      requestorId: "opponent",
      status: "cancelled",
      cancelledReason: "cancelled",
    });
    expect(io._toSpy).toHaveBeenCalledWith("rematch_cancelled", {
      roomId: room.id,
      requestorId: "opponent",
      status: "cancelled",
      reason: "cancelled",
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: room.id,
        rematchRequest: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(room.requestRematch("owner")).toBe(-4);
  });

  it("does not let the other player cancel the request", () => {
    const room = createFinishedWarRoom("rematch-cancel-forbidden-room");
    createSessions();
    expect(room.requestRematch("opponent")).toBe(1);

    const io = createIo();
    const socket = createSocket("owner");
    factoryCancelRematchHandler(io, socket)();

    expect(room.getGameState("owner")?.rematchRequest?.status).toBe("pending");
    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      "Rematch cannot be cancelled",
    );
  });

  it("auto-cancels a pending rematch after the timeout", () => {
    vi.useFakeTimers();
    try {
      const room = createFinishedWarRoom("rematch-timeout-room");
      createSessions();

      const io = createIo();
      const socket = createSocket("opponent");
      factoryRequestRematchHandler(io, socket)();
      expect(room.getGameState("owner")?.rematchRequest?.status).toBe(
        "pending",
      );

      vi.advanceTimersByTime(60_000);

      expect(room.getGameState("owner")?.rematchRequest).toMatchObject({
        requestorId: "opponent",
        status: "cancelled",
        cancelledReason: "timeout",
      });
      expect(io._toSpy).toHaveBeenCalledWith("rematch_cancelled", {
        roomId: room.id,
        requestorId: "opponent",
        status: "cancelled",
        reason: "timeout",
      });
      expect(room.requestRematch("owner")).toBe(-4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a pending rematch and notifies the requestor", () => {
    const room = createFinishedWarRoom("rematch-rejected-room");
    createSessions();
    expect(room.requestRematch("opponent")).toBe(1);

    const io = createIo();
    const socket = createSocket("owner");
    factoryRejectRematchHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("owner")?.rematchRequest).toEqual({
      requestId: "00000000-0000-4000-8000-000000000001",
      requestorId: "opponent",
      status: "rejected",
      name: "opponent-name",
      seed: 80,
      expiresAt: expect.any(String),
    });
    expect(io._toSpy).toHaveBeenCalledWith("rematch_rejected", {
      roomId: room.id,
      requestorId: "opponent",
      status: "rejected",
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: room.id,
        phase: EGamePhase.Finished,
        rematchRequest: expect.objectContaining({ status: "rejected" }),
      }),
    );
  });
});
