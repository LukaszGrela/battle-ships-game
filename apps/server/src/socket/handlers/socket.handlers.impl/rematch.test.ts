import { afterEach, describe, expect, it } from "vitest";
import {
  EGamePhase,
  IPlayer,
  TCellStatusShipId,
  TShip,
} from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { createIo, createSocket } from "./__tests/utils";
import {
  factoryAcceptRematchHandler,
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

const createSessions = () => {
  sessionService.createSession("owner", "owner-socket");
  sessionService.createSession("opponent", "opponent-socket");
};

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
      requestorId: "opponent",
      status: "pending",
      name: "opponent-name",
      seed: 80,
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
      requestorId: "opponent",
      status: "pending",
      name: "opponent-name",
      seed: 80,
    });
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
    expect(room.getPlayer("owner")).toMatchObject({ ready: false, owner: true });
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

  it("rejects a pending rematch and notifies the requestor", () => {
    const room = createFinishedWarRoom("rematch-rejected-room");
    createSessions();
    expect(room.requestRematch("opponent")).toBe(1);

    const io = createIo();
    const socket = createSocket("owner");
    factoryRejectRematchHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getGameState("owner")?.rematchRequest).toEqual({
      requestorId: "opponent",
      status: "rejected",
      name: "opponent-name",
      seed: 80,
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
