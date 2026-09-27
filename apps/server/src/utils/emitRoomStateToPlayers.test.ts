import { describe, expect, it, vi } from "vitest";
import { EGamePhase } from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";

const sessionService = ClientSessionServiceSingleton.getInstance();

const createRoom = () => ({
  id: "room-1",
  name: "Pirate Room",
  game_created: "2026-09-25T00:00:00.000Z",
  game_started: null,
  game_finished: null,
  history: [],
  result: {},
  phase: EGamePhase.Waiting,
  players: {
    owner: {
      id: "owner",
      name: "Captain Black",
      active: true,
      ready: false,
      seed: 42,
      owner: true,
    },
    opponent: {
      id: "opponent",
      name: "Captain Red",
      active: true,
      ready: false,
      seed: 7,
      owner: false,
    },
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

describe("emitRoomStateToPlayers", () => {
  it("emits room state to all connected players except the skipped one", () => {
    const room = createRoom();
    const io = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as any;

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    emitRoomStateToPlayers(io, room, "owner");

    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith("opponent-socket");
  });

  it("skips players without a valid session", () => {
    const room = createRoom();
    const io = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as any;

    sessionService.createSession("owner", "owner-socket");
    sessionService.deleteSession("opponent");

    emitRoomStateToPlayers(io, room);

    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith("owner-socket");
  });
});
