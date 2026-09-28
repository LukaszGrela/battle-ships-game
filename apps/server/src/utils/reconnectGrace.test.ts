import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase } from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import RoomServiceSingleton from "../services/room.service";
import { expireDisconnectedPlayers, getReconnectTimeoutMs } from "./reconnectGrace";

const sessionService = ClientSessionServiceSingleton.getInstance();
const roomService = RoomServiceSingleton.getInstance();

describe("reconnectGrace", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    sessionService.listSessions().forEach((session) => sessionService.deleteSession(session.id));
  });

  it("defaults to a 60 second reconnect timeout", () => {
    expect(getReconnectTimeoutMs()).toBe(60_000);
  });

  it("forfeits a playing room when a player has been disconnected longer than the timeout", () => {
    const owner = sessionService.createSession("owner", "owner-socket");
    const opponent = sessionService.createSession("opponent", "opponent-socket");
    owner.gameId = "room-1";
    opponent.gameId = "room-1";
    owner.disconnectedAt = Date.now() - 61_000;
    sessionService.updateSession("owner", owner);
    sessionService.updateSession("opponent", opponent);

    roomService.saveRoom({
      id: "room-1",
      name: "Grace Room",
      game_created: "2026-09-28T00:00:00.000Z",
      game_started: "2026-09-28T00:01:00.000Z",
      game_finished: null,
      history: [],
      result: {},
      phase: EGamePhase.Playing,
      players: {
        owner: { id: "owner", name: "Owner", active: true, ready: true, owner: true, seed: 1 },
        opponent: { id: "opponent", name: "Opponent", active: true, ready: true, owner: false, seed: 2 },
      },
      boards: {
        owner: [],
        opponent: [],
      },
      ships: {
        owner: [],
        opponent: [],
      },
      turn: "owner",
    });

    const io = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      emit: vi.fn(),
    } as any;

    expireDisconnectedPlayers(io);

    const updatedRoom = roomService.getRoom("room-1");
    expect(updatedRoom?.phase).toBe(EGamePhase.Finished);
    expect(updatedRoom?.result).toEqual({ owner: "lost", opponent: "win" });
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(sessionService.readSession("opponent")?.gameId).toBeUndefined();
  });
});
