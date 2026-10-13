import { afterEach, describe, expect, it, vi } from "vitest";
import { ECellStatus, EGamePhase, TRoomState, TShip } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { factoryAttackCoordinateHandler } from "./attack_coordinate";
import { placeShip } from "@repo/game-logic";
import {
  createGameRoom,
  createIo,
  createPlacedShip,
  createSocket,
} from "./__tests/utils";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const cleanup = (...roomIds: string[]) => {
  roomIds.forEach((roomId) => roomService.deleteRoom(roomId));
  ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
};

describe("attack_coordinate handler", () => {
  afterEach(() => {
    roomService.listRooms().forEach((room) => roomService.deleteRoom(room.id));
    ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
  });

  it("applies a valid hit, flips the turn, and emits the updated game state", () => {
    const roomId = "attack-hit";
    const room = createGameRoom(
      roomId,
      "owner",
      "Attack Room",
      EGamePhase.Playing,
    )!;

    placeShip(
      room.boards.opponent!,
      { x: 2, y: 3 },
      createPlacedShip(9),
      "horizontal",
    );

    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();

    handler({ x: 2, y: 3 }, callback);

    const updatedRoom = roomService.getRoom(roomId)!;
    expect(updatedRoom.turn).toBe("opponent");
    expect(updatedRoom.boards.opponent?.[3]?.[2]).toBe(ECellStatus.Hit);
    expect(updatedRoom.history.at(-1)).toMatchObject({
      turn: "owner",
      result: ECellStatus.Hit,
    });

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      status: ECellStatus.Hit,
    });

    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        id: roomId,
        phase: EGamePhase.Playing,
      }),
    );

    cleanup(roomId);
  });

  it("rejects an attack when it is not the player's turn", () => {
    const roomId = "attack-not-your-turn";
    const room = createGameRoom(
      roomId,
      "opponent",
      "Attack Room",
      EGamePhase.Playing,
    );
    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();
    handler({ x: 0, y: 0 }, callback);

    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      "Not your turn or game not active",
    );

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      message: "Not your turn or game not active",
    });

    expect(io._toSpy).not.toHaveBeenCalledWith(
      "game_updated",
      expect.anything(),
    );

    cleanup(roomId);
  });

  it("finishes the match when the enemy fleet is sunk", () => {
    const roomId = "attack-finish";
    const room = createGameRoom(
      roomId,
      "owner",
      "Attack Room",
      EGamePhase.Playing,
    );

    placeShip(
      room.boards.opponent!,
      { x: 0, y: 0 },
      createPlacedShip(9),
      "horizontal",
    );

    room.ships.opponent = [
      {
        id: 9,
        size: 1,
        type: "placed",
        coords: { x: 0, y: 0 },
        orientation: "horizontal",
        hits: [],
      },
    ];
    roomService.saveRoom(room);

    sessionService.createSession("owner", "owner-socket");
    sessionService.createSession("opponent", "opponent-socket");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const io = createIo();
    const socket = createSocket("owner");
    const handler = factoryAttackCoordinateHandler(io, socket);

    const callback = vi.fn();
    handler({ x: 0, y: 0 }, callback);

    const updatedRoom = roomService.getRoom(roomId)!;

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      status: ECellStatus.Destroyed,
      size: 1,
    });

    expect(updatedRoom.phase).toBe(EGamePhase.Finished);
    expect(updatedRoom.result).toEqual({ owner: "win", opponent: "lost" });
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({
        phase: EGamePhase.Finished,
        id: roomId,
      }),
    );

    cleanup(roomId);
  });
});
