import { afterEach, describe, expect, it, vi } from "vitest";
import { EGamePhase, IPlayer, TCellStatusShipId, TShip } from "@repo/types";
import ClientSessionServiceSingleton from "../services/client-session.service";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import { WarRoom } from "../services/WarRoom";
import {
  expireDisconnectedPlayers,
  getReconnectTimeoutMs,
} from "./reconnectGrace";

const sessionService = ClientSessionServiceSingleton.getInstance();
const activeGames = ActiveGameRegistrySingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: id === "owner" ? "Owner" : "Opponent",
  active: true,
  ready: false,
  owner,
  seed: id === "owner" ? 1 : 2,
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

describe("reconnectGrace", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    sessionService
      .listSessions()
      .forEach((session) => sessionService.deleteSession(session.id));
  });

  it("defaults to a 60 second reconnect timeout", () => {
    expect(getReconnectTimeoutMs()).toBe(60_000);
  });

  it("forfeits a playing room when a player has been disconnected longer than the timeout", () => {
    const owner = sessionService.createSession("owner", 1, "owner-socket");
    const opponent = sessionService.createSession(
      "opponent",
      2,
      "opponent-socket",
    );
    owner.gameId = "room-1";
    opponent.gameId = "room-1";
    owner.disconnectedAt = Date.now() - 61_000;
    sessionService.updateSession("owner", owner);
    sessionService.updateSession("opponent", opponent);

    const room = new WarRoom(
      "room-1",
      "Grace Room",
      createPlayer("owner", true),
    );
    room.addPlayer(createPlayer("opponent"));
    expect(room.placeShips("owner", createFleet())).toBe(true);
    expect(room.placeShips("opponent", createFleet())).toBe(true);
    expect(room.getPhase()).toBe(EGamePhase.Playing);
    // The disconnect handler deactivates the player while the grace timer runs.
    expect(room.deactivatePlayer("owner")).toBe(true);
    expect(room.getPlayer("owner")?.active).toBe(false);
    activeGames.addRoom(room.id, room);

    const emit = vi.fn();
    const io = {
      to: vi.fn().mockReturnValue({ emit }),
      emit: vi.fn(),
    } as any;

    expireDisconnectedPlayers(io);

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getPlayer("owner")?.active).toBe(false);
    expect(room.getGameState("opponent")?.result).toEqual({
      owner: "lost",
      opponent: "win",
    });
    expect(io.to).toHaveBeenCalledWith("owner-socket");
    expect(io.to).toHaveBeenCalledWith("opponent-socket");
    expect(emit).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: room.id,
        phase: EGamePhase.Finished,
        result: { owner: "lost", opponent: "win" },
      }),
    );
    expect(owner.gameId).toBe(room.id);
    expect(opponent.gameId).toBe(room.id);
  });
});
