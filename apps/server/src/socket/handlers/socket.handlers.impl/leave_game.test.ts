import { afterEach, describe, expect, it } from "vitest";
import {
  EGamePhase,
  IPlayer,
  TCellStatusShipId,
  TGameState,
  TShip,
} from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryLeaveGameHandler } from "./leave_game";
import { createIo, createSocket } from "./__tests/utils";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

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

const createWaitingRoom = (id: string) => {
  const room = new WarRoom(id, `Room ${id}`, {
    ...createPlayer("owner", "Captain Black", true),
  });
  activeGames.addRoom(id, room);
  return room;
};

const createPlacementRoom = (id: string) => {
  const room = createWaitingRoom(id);
  room.addPlayer(createPlayer("opponent", "Captain Red"));
  return room;
};

const createPlayingRoom = (id: string) => {
  const room = createPlacementRoom(id);
  const game = (room as any).currentGame;
  game.phase = EGamePhase.Playing;
  game.updatePlayer({ id: "owner", active: true, ready: true });
  game.updatePlayer({ id: "opponent", active: true, ready: true });
  return room;
};

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

const linkSessionToRoom = (clientId: string, roomId: string) => {
  const session = sessionService.readSession(clientId);
  if (!session) {
    throw new Error(`Missing session for ${clientId}`);
  }

  session.gameId = roomId;
  sessionService.updateSession(clientId, session);
};

const cleanup = () => {
  activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  ["owner", "opponent", "third"].forEach((id) =>
    sessionService.deleteSession(id),
  );
};

describe("leave_game handler", () => {
  afterEach(cleanup);

  it("destroys a waiting room and clears the owner session when the player leaves early", () => {
    const room = createWaitingRoom("leave-waiting");
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    linkSessionToRoom("owner", room.id);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(activeGames.hasRoom("leave-waiting")).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
    expect(io.emit).toHaveBeenCalledWith("open_games", expect.any(Array));
  });

  it("moves a placement room back to waiting when the player leaves", () => {
    const room = createPlacementRoom("leave-placement");
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    linkSessionToRoom("owner", room.id);
    linkSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(room.getPhase()).toBe(EGamePhase.Waiting);
    expect(room.getPlayer("owner")).toBeUndefined();
    expect(room.getPlayer("opponent")).toMatchObject({
      id: "opponent",
      owner: true,
      active: true,
      ready: false,
    });
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(sessionService.readSession("opponent")?.gameId).toBe(room.id);
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
    expect(io._toSpy).toHaveBeenCalledWith("player_left", {
      id: "owner",
      name: "Captain Black",
      seed: 42,
    });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: room.id,
        name: room.name,
        phase: EGamePhase.Waiting,
        self: expect.objectContaining({ id: "opponent", owner: true }),
      }),
    );
  });

  it("resets the ready player's fleet and state when their opponent leaves placement", () => {
    const room = createPlacementRoom("leave-placement-ready");
    expect(room.placeShips("owner", createFleet())).toBe(true);
    expect(room.getPlayer("owner")?.ready).toBe(true);

    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    linkSessionToRoom("owner", room.id);
    linkSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("opponent");
    factoryLeaveGameHandler(io, socket)();

    expect(room.getPhase()).toBe(EGamePhase.Waiting);
    expect(room.getPlayer("owner")).toMatchObject({
      id: "owner",
      owner: true,
      ready: false,
      active: true,
    });
    expect(room.getGameState("owner")?.myBoard.every((row) =>
      row.every((cell) => cell === -1),
    )).toBe(true);
    expect(sessionService.readSession("opponent")?.gameId).toBeUndefined();

    expect(room.addPlayer(createPlayer("third", "Captain Green"))).toBe(true);
    const ownerPlacementState = room.getGameState("owner") as
      | (TGameState & { phase: EGamePhase.Placement })
      | null;
    expect(ownerPlacementState?.phase).toBe(EGamePhase.Placement);
    expect(ownerPlacementState?.self.ready).toBe(false);
    expect(
      ownerPlacementState?.ships?.every(
        (ship) => ship.type === "pending" && !ship.placed,
      ),
    ).toBe(true);
  });

  it("forfeits the game when a player leaves during play", () => {
    const room = createPlayingRoom("leave-playing");
    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);
    linkSessionToRoom("owner", room.id);
    linkSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getPlayer("owner")?.active).toBe(false);
    expect(room.getPlayer("opponent")?.active).toBe(true);
    expect(sessionService.readSession("owner")?.gameId).toBe(room.id);
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Finished, id: room.id }),
    );
  });

  it("notifies the opponent and clears the leaving player's session when a finished game is abandoned", () => {
    const room = createWaitingRoom("leave-finished");
    const opponent = createPlayer("opponent", "Captain Red");
    room.addPlayer(opponent);
    const game = (room as any).currentGame;
    game.phase = EGamePhase.Finished;
    game.updatePlayer({ id: "owner", active: true, ready: true });
    game.updatePlayer({ id: "opponent", active: true, ready: true });

    const ownerSession = sessionService.createSession("owner", "owner-socket");
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.createSession(
      "opponent",
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    opponentSession.socketId = "opponent-socket";
    sessionService.updateSession("opponent", opponentSession);
    linkSessionToRoom("owner", room.id);
    linkSessionToRoom("opponent", room.id);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryLeaveGameHandler(io, socket);

    handler();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(socket.emit).not.toHaveBeenCalledWith(
      "game_updated",
      expect.anything(),
    );
    expect(io.emit).not.toHaveBeenCalledWith("open_games", expect.anything());
    expect(io._toSpy).toHaveBeenCalledWith(
      "player_left",
      expect.objectContaining({ id: "owner", name: "Captain Black" }),
    );
  });
});
