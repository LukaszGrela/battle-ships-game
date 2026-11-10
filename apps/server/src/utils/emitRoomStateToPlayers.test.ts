import { afterEach, describe, expect, it, vi } from "vitest";
import { IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { WarRoom } from "../services/WarRoom";
import { emitRoomStateToPlayers } from "./emitRoomStateToPlayers";

const sessionService = ClientSessionServiceSingleton.getInstance();
const activeGames = ActiveGameRegistrySingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: id === "owner" ? "Captain Black" : "Captain Red",
  active: true,
  ready: false,
  seed: id === "owner" ? 42 : 7,
  owner,
});

const createRoom = () => {
  const room = new WarRoom(
    "room-1",
    "Pirate Room",
    createPlayer("owner", true),
  );
  room.addPlayer(createPlayer("opponent"));
  activeGames.addRoom(room.id, room);
  return room;
};

describe("emitRoomStateToPlayers", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("emits room state to all connected players except the skipped one", () => {
    const room = createRoom();
    const emit = vi.fn();
    const io = {
      to: vi.fn().mockReturnValue({ emit }),
    } as any;

    sessionService.createSession("owner", 1, "owner-socket");
    sessionService.createSession("opponent", 2, "opponent-socket");

    emitRoomStateToPlayers(io, "owner", room.id, "owner");

    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith("opponent-socket");
    expect(emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ id: room.id, name: room.name }),
    );
  });

  it("skips players without a valid session", () => {
    const room = createRoom();
    const io = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    } as any;

    sessionService.createSession("owner", 1, "owner-socket");
    sessionService.deleteSession("opponent");

    emitRoomStateToPlayers(io, "owner", room.id);

    expect(io.to).toHaveBeenCalledTimes(1);
    expect(io.to).toHaveBeenCalledWith("owner-socket");
  });
});
