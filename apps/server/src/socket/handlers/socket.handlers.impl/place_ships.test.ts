import { afterEach, describe, expect, it } from "vitest";
import {
  EGamePhase,
  IPlayer,
  TCellStatusEmpty,
  TCellStatusShipId,
  TShip,
} from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryPlaceShipsHandler } from "./place_ships";
import { createIo, createSocket } from "./__tests/utils";

const empty: TCellStatusEmpty = -1;

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (id: string, name: string, owner = false): IPlayer => ({
  id,
  name,
  active: true,
  ready: false,
  owner,
  seed: id === "owner" ? 42 : 7,
});

const createPlacementRoom = (id: string, name: string) => {
  const ownerSession = sessionService.createSession("owner", 1, "owner-socket");
  ownerSession.name = "Captain Black";
  sessionService.updateSession("owner", ownerSession);

  const opponentSession = sessionService.createSession(
    "opponent",
    2,
    "opponent-socket",
  );
  opponentSession.name = "Captain Red";
  sessionService.updateSession("opponent", opponentSession);

  const room = new WarRoom(
    id,
    name,
    createPlayer("owner", "Captain Black", true),
  );
  room.addPlayer(createPlayer("opponent", "Captain Red"));
  activeGames.addRoom(id, room);

  for (const playerId of ["owner", "opponent"]) {
    const session = sessionService.readSession(playerId)!;
    session.gameId = id;
    sessionService.updateSession(playerId, session);
  }

  return room;
};

const createValidShips = (): (TShip & {
  type: "pending";
  id: TCellStatusShipId;
})[] => [
  {
    id: 1,
    size: 5,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 0 },
    orientation: "horizontal",
  },
  {
    id: 2,
    size: 4,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 2 },
    orientation: "horizontal",
  },
  {
    id: 3,
    size: 3,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 4 },
    orientation: "horizontal",
  },
  {
    id: 4,
    size: 3,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 6 },
    orientation: "horizontal",
  },
  {
    id: 5,
    size: 2,
    type: "pending",
    placed: false,
    coords: { x: 0, y: 8 },
    orientation: "horizontal",
  },
];

describe("place_ships handler", () => {
  afterEach(() => {
    activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
    ["owner", "opponent", "third"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("marks a player ready and stores only valid placed ships when the opponent is not ready yet", () => {
    const room = createPlacementRoom("place-room-ready", "Ready Room");

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    const payload = createValidShips();
    handler(payload);

    const gameState = room.getGameState("owner");
    expect(room.getPhase()).toBe(EGamePhase.Placement);
    expect(room.getPlayer("owner")?.ready).toBe(true);
    expect(gameState?.myBoard[0]?.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Placement,
        id: room.id,
      }),
    );
    expect(io._toSpy).toHaveBeenCalledWith(
      "player_ready",
      expect.objectContaining({
        name: "Captain Black",
        ready: true,
      }),
    );
  });

  it("writes each placed ship onto the board at its coordinates", () => {
    const room = createPlacementRoom(
      "place-room-board-check",
      "Board Check Room",
    );

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    handler(createValidShips());

    const ownerBoard = room.getGameState("owner")?.myBoard;
    expect(ownerBoard?.[0]?.[0]).toBe(1);
    expect(ownerBoard?.[0]?.[1]).toBe(1);
    expect(ownerBoard?.[0]?.[4]).toBe(1);
    expect(ownerBoard?.[0]?.[5]).toBe(empty);
  });

  it("transitions to playing when both players are already ready and broadcasts the game state to both sockets", () => {
    const room = createPlacementRoom("place-room-playing", "Battle Room");
    expect(room.placeShips("opponent", createValidShips())).toBe(true);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryPlaceShipsHandler(io, socket);

    handler(createValidShips());

    expect(room.getPhase()).toBe(EGamePhase.Playing);
    expect(room.getTimeStamps().game_started).not.toBeNull();
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Playing,
        id: room.id,
      }),
    );
  });
});
