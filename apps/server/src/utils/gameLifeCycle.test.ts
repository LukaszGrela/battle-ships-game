import {
  ECellStatus,
  EGamePhase,
  IPlayer,
  TRoomState,
  TShip,
} from "@repo/types";
import RoomServiceSingleton from "../services/room.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import {
  applyShipsAndMarkReady,
  createWarRoom,
  destroyWarRoom,
  transitionToPlacement,
  transitionToPlaying,
  transitionToFinished,
  transitionToWaiting,
  updateRoomWithNewTurnData,
} from "./gameLifeCycle";
import { getCell, placeShip, setCell } from "@repo/game-logic";

const roomService = RoomServiceSingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: `${id}-name`,
  active: true,
  ready: false,
  seed: id.length,
  owner,
});

const createRoom = (
  id: string,
  phase: TRoomState["phase"],
  players: IPlayer[],
): TRoomState => ({
  id,
  name: `${id}-name`,
  game_created: "2026-09-25T00:00:00.000Z",
  game_started:
    phase === EGamePhase.Waiting ? null : "2026-09-25T00:01:00.000Z",
  game_finished:
    phase === EGamePhase.Finished ? "2026-09-25T00:02:00.000Z" : null,
  history: [],
  result: {},
  phase,
  players: Object.fromEntries(players.map((player) => [player.id, player])),
  boards: Object.fromEntries(players.map((player) => [player.id, []])),
  ships: Object.fromEntries(players.map((player) => [player.id, []])),
  turn: players[0]?.id ?? "",
});

const createPlacedShip = (id: number): TShip => ({
  id,
  size: 1,
  type: "placed",
  coords: { x: 0, y: 0 },
  orientation: "horizontal",
  hits: [],
});

const createEmptyBoard = () =>
  Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ECellStatus.Empty),
  );

const saveSessions = (...ids: string[]) => {
  ids.forEach((id) => sessionService.createSession(id, `${id}-socket`));
};

const saveRoom = (room: TRoomState) => {
  roomService.saveRoom(room);
  return room;
};

const cleanup = (...roomIds: string[]) => {
  roomIds.forEach((roomId) => roomService.deleteRoom(roomId));
  ["owner", "opponent", "third", "unknown", "winner", "loser"].forEach((id) =>
    sessionService.deleteSession(id),
  );
};

describe("game lifecycle", () => {
  it("creates a waiting room for a valid owner and links the session to it", () => {
    const roomId = "war-room-created";
    const roomName = "Dread Pirate";
    saveSessions("owner");
    const session = sessionService.readSession("owner")!;
    session.name = "Captain Black";
    session.seed = 42;
    sessionService.updateSession("owner", session);

    const result = createWarRoom({ id: roomId, name: roomName }, "owner");

    expect(result).toEqual(
      expect.objectContaining({
        id: roomId,
        name: roomName,
        phase: EGamePhase.Waiting,
        players: expect.objectContaining({
          owner: expect.objectContaining({
            id: "owner",
            name: "Captain Black",
            seed: 42,
            owner: true,
          }),
        }),
      }),
    );
    expect(result?.boards).toHaveProperty("owner");
    expect(result?.turn).toBe("owner");
    expect(sessionService.readSession("owner")?.gameId).toBe(roomId);
    expect(roomService.getRoom(roomId)?.phase).toBe(EGamePhase.Waiting);

    cleanup(roomId);
  });

  it("removes a room and clears the owner session when destroyWarRoom is called", () => {
    const roomId = "war-room-destroyed";
    const roomName = "Abandoned Ship";
    saveSessions("owner");
    const session = sessionService.readSession("owner")!;
    session.name = "Captain Black";
    session.seed = 42;
    sessionService.updateSession("owner", session);

    const room = createWarRoom({ id: roomId, name: roomName }, "owner");
    expect(room).toBeDefined();
    expect(sessionService.readSession("owner")?.gameId).toBe(roomId);

    destroyWarRoom("owner");

    expect(roomService.getRoom(roomId)).toBeUndefined();
    expect(roomService.hasRoom(roomId)).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();

    cleanup(roomId);
  });

  it("rejects creating a room when the owner is already in an active game", () => {
    const roomId = "war-room-reject-active";
    const otherRoomId = "other-active-room";
    saveSessions("owner");
    saveRoom(
      createRoom(otherRoomId, EGamePhase.Placement, [
        createPlayer("owner", true),
      ]),
    );
    const session = sessionService.readSession("owner")!;
    session.gameId = otherRoomId;
    sessionService.updateSession("owner", session);

    expect(
      createWarRoom({ id: roomId, name: "Pirate Room" }, "owner"),
    ).toBeUndefined();

    cleanup(roomId, otherRoomId);
  });

  it("rejects creating a room when the room id is already taken", () => {
    const roomId = "war-room-duplicate";
    saveSessions("owner");
    saveRoom(
      createRoom(roomId, EGamePhase.Waiting, [createPlayer("existing", true)]),
    );

    expect(
      createWarRoom({ id: roomId, name: "Pirate Room" }, "owner"),
    ).toBeUndefined();

    cleanup(roomId);
  });

  it("transitions a waiting room to placement when a second player joins", () => {
    const roomId = "lifecycle-placement";
    const owner = createPlayer("owner", true);
    const room = saveRoom(createRoom(roomId, EGamePhase.Waiting, [owner]));
    saveSessions("owner", "opponent");

    const result = transitionToPlacement(roomId, "opponent");

    expect(result).toEqual(
      expect.objectContaining({ phase: EGamePhase.Placement }),
    );
    expect(result?.players).toEqual(
      expect.objectContaining({
        owner,
        opponent: expect.objectContaining({ id: "opponent", active: true }),
      }),
    );
    expect(result?.ships).toHaveProperty("owner");
    expect(result?.ships).toHaveProperty("opponent");
    expect(sessionService.readSession("opponent")?.gameId).toBe(room.id);
    expect(roomService.getRoom(roomId)?.phase).toBe(EGamePhase.Placement);

    cleanup(roomId);
  });

  it("rejects a join when the waiting room does not contain exactly one player", () => {
    const roomId = "lifecycle-invalid-placement";
    saveRoom(
      createRoom(roomId, EGamePhase.Waiting, [
        createPlayer("owner", true),
        createPlayer("opponent"),
      ]),
    );
    saveSessions("third");

    expect(transitionToPlacement(roomId, "third")).toBeUndefined();

    cleanup(roomId);
  });

  it("rejects a player that is already in another active room", () => {
    const roomId = "lifecycle-placement-active";
    const otherRoomId = "lifecycle-other-active";
    saveRoom(
      createRoom(roomId, EGamePhase.Waiting, [createPlayer("owner", true)]),
    );
    saveRoom(
      createRoom(otherRoomId, EGamePhase.Placement, [
        createPlayer("opponent"),
        createPlayer("third"),
      ]),
    );
    saveSessions("opponent");
    const session = sessionService.readSession("opponent")!;
    session.gameId = otherRoomId;
    sessionService.updateSession("opponent", session);

    expect(transitionToPlacement(roomId, "opponent")).toBeUndefined();

    cleanup(roomId, otherRoomId);
  });

  it("transitions placement to waiting and removes only the leaving player", () => {
    const roomId = "lifecycle-waiting";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    saveRoom(createRoom(roomId, EGamePhase.Placement, [owner, opponent]));
    saveSessions("owner", "opponent");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const result = transitionToWaiting(roomId, "owner");

    expect(result?.phase).toBe(EGamePhase.Waiting);
    expect(result?.players).toEqual({
      opponent: expect.objectContaining({ owner: true }),
    });
    expect(result?.boards).toEqual({ opponent: [] });
    expect(result?.ships).toEqual({});
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();

    cleanup(roomId);
  });

  it("rejects moving a player that is not in the room back to waiting", () => {
    const roomId = "lifecycle-invalid-waiting-player";
    saveRoom(
      createRoom(roomId, EGamePhase.Placement, [
        createPlayer("owner", true),
        createPlayer("opponent"),
      ]),
    );
    saveSessions("unknown");
    const session = sessionService.readSession("unknown")!;
    session.gameId = roomId;
    sessionService.updateSession("unknown", session);

    expect(transitionToWaiting(roomId, "unknown")).toBeUndefined();

    cleanup(roomId);
  });

  it("marks a player ready during placement without advancing the room to playing", () => {
    const roomId = "lifecycle-ready-placement";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    saveRoom(createRoom(roomId, EGamePhase.Placement, [owner, opponent]));
    saveSessions("owner", "opponent");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const ships = [createPlacedShip(1), createPlacedShip(2)] as (TShip & {
      type: "placed";
    })[];
    const result = applyShipsAndMarkReady(roomId, "owner", ships);

    expect(result?.phase).toBe(EGamePhase.Placement);
    expect(result?.players.owner?.ready).toBe(true);
    expect(result?.players.opponent?.ready).toBe(false);
    expect(result?.ships.owner).toEqual(ships);
    expect(roomService.getRoom(roomId)?.phase).toBe(EGamePhase.Placement);

    cleanup(roomId);
  });

  it("does not start playing until the other player is ready", () => {
    const roomId = "lifecycle-premature-playing";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    saveRoom(createRoom(roomId, EGamePhase.Placement, [owner, opponent]));
    saveSessions("owner", "opponent");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    expect(
      transitionToPlaying(roomId, "owner", [createPlacedShip(1)] as (TShip & {
        type: "placed";
      })[]),
    ).toBeUndefined();
    expect(roomService.getRoom(roomId)?.phase).toBe(EGamePhase.Placement);

    cleanup(roomId);
  });

  it("starts playing when both players are ready and stores the last placement", () => {
    const roomId = "lifecycle-playing";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    opponent.ready = true;
    saveRoom(createRoom(roomId, EGamePhase.Placement, [owner, opponent]));
    saveSessions("owner", "opponent");

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const ships = [createPlacedShip(1)] as (TShip & { type: "placed" })[];

    const result = transitionToPlaying(roomId, "owner", ships);

    expect(result?.phase).toBe(EGamePhase.Playing);
    expect(result?.players.owner?.ready).toBe(true);
    expect(result?.players.opponent?.ready).toBe(true);
    expect(result?.ships.owner).toEqual(ships);
    expect(result?.game_started).not.toBeNull();

    cleanup(roomId);
  });

  it("updates turn data during play when a ship is hit", () => {
    const roomId = "lifecycle-turn-hit";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    saveRoom(createRoom(roomId, EGamePhase.Playing, [owner, opponent]));
    saveSessions("owner", "opponent");

    const room = roomService.getRoom(roomId)!;
    room.turn = "owner";
    room.boards.owner = createEmptyBoard();
    room.boards.opponent = createEmptyBoard();

    placeShip(
      room.boards.opponent,
      { x: 2, y: 3 },
      createPlacedShip(7),
      "horizontal",
    );

    room.ships.opponent = [
      {
        id: 7,
        size: 2,
        type: "placed",
        coords: { x: 2, y: 3 },
        orientation: "horizontal",
        hits: [],
      },
    ];
    roomService.saveRoom(room);

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const result = updateRoomWithNewTurnData(roomId, "owner", { x: 2, y: 3 });

    expect(result?.turn).toBe("opponent");
    expect(result?.boards.opponent?.[3]?.[2]).toBe(ECellStatus.Hit);
    expect(result?.history.at(-1)).toMatchObject({
      turn: "owner",
      result: ECellStatus.Hit,
    });

    cleanup(roomId);
  });

  it("ignores a repeated attack on the same coordinate during play", () => {
    const roomId = "lifecycle-turn-repeat";
    const owner = createPlayer("owner", true);
    const opponent = createPlayer("opponent");
    saveRoom(createRoom(roomId, EGamePhase.Playing, [owner, opponent]));
    saveSessions("owner", "opponent");

    const room = roomService.getRoom(roomId)!;
    room.turn = "owner";
    room.boards.owner = createEmptyBoard();
    room.boards.opponent = createEmptyBoard();

    setCell(room.boards.opponent, 1, 1, ECellStatus.Miss);

    roomService.saveRoom(room);

    const ownerSession = sessionService.readSession("owner")!;
    ownerSession.gameId = roomId;
    sessionService.updateSession("owner", ownerSession);
    const opponentSession = sessionService.readSession("opponent")!;
    opponentSession.gameId = roomId;
    sessionService.updateSession("opponent", opponentSession);

    const result = updateRoomWithNewTurnData(roomId, "owner", { x: 1, y: 1 });

    expect(result).toBeUndefined();
    expect(roomService.getRoom(roomId)?.turn).toBe("owner");
    expect(getCell(roomService.getRoom(roomId)?.boards.opponent!, 1, 1)).toBe(
      ECellStatus.Miss,
    );
    expect(roomService.getRoom(roomId)?.history).toEqual([]);

    cleanup(roomId);
  });

  it("finishes a playing room when a player wins", () => {
    const roomId = "lifecycle-finished-win";
    const winner = createPlayer("winner", true);
    const loser = createPlayer("loser");
    saveRoom(createRoom(roomId, EGamePhase.Playing, [winner, loser]));
    saveSessions("winner", "loser");

    const winnerSession = sessionService.readSession("winner")!;
    winnerSession.gameId = roomId;
    sessionService.updateSession("winner", winnerSession);
    const loserSession = sessionService.readSession("loser")!;
    loserSession.gameId = roomId;
    sessionService.updateSession("loser", loserSession);

    const result = transitionToFinished(roomId, "winner");

    expect(result?.phase).toBe(EGamePhase.Finished);
    expect(result?.result).toEqual({ winner: "win", loser: "lost" });
    expect(result?.history).toEqual([{ finish: true, whoWon: "winner" }]);
    expect(result?.game_finished).not.toBeNull();
    expect(sessionService.readSession("winner")?.gameId).toBeUndefined();
    expect(sessionService.readSession("loser")?.gameId).toBeUndefined();

    cleanup(roomId);
  });

  it("finishes a playing room by forfeiture and marks the forfeiting player inactive", () => {
    const roomId = "lifecycle-finished-forfeit";
    const winner = createPlayer("winner", true);
    const loser = createPlayer("loser");
    saveRoom(createRoom(roomId, EGamePhase.Playing, [winner, loser]));
    saveSessions("winner", "loser");

    const winnerSession = sessionService.readSession("winner")!;
    winnerSession.gameId = roomId;
    sessionService.updateSession("winner", winnerSession);
    const loserSession = sessionService.readSession("loser")!;
    loserSession.gameId = roomId;
    sessionService.updateSession("loser", loserSession);

    const result = transitionToFinished(roomId, "loser", true);

    expect(result?.phase).toBe(EGamePhase.Finished);
    expect(result?.result).toEqual({ loser: "lost", winner: "win" });
    expect(result?.players.loser?.active).toBe(false);
    expect(result?.history).toEqual([{ finish: true, whoWon: "winner" }]);

    cleanup(roomId);
  });

  it("rejects a finisher who is not a player in the room", () => {
    const roomId = "lifecycle-invalid-winner";
    saveRoom(
      createRoom(roomId, EGamePhase.Playing, [
        createPlayer("winner", true),
        createPlayer("loser"),
      ]),
    );
    saveSessions("unknown");
    const unknownSession = sessionService.readSession("unknown")!;
    unknownSession.gameId = roomId;
    sessionService.updateSession("unknown", unknownSession);

    expect(transitionToFinished(roomId, "unknown")).toBeUndefined();

    cleanup(roomId);
  });

  it("rejects all transitions after a room is finished", () => {
    const roomId = "lifecycle-terminal";
    saveRoom(
      createRoom(roomId, EGamePhase.Finished, [
        createPlayer("winner", true),
        createPlayer("loser"),
      ]),
    );
    saveSessions("winner", "loser");

    const winnerSession = sessionService.readSession("winner")!;
    winnerSession.gameId = roomId;
    sessionService.updateSession("winner", winnerSession);
    const loserSession = sessionService.readSession("loser")!;
    loserSession.gameId = roomId;
    sessionService.updateSession("loser", loserSession);

    expect(transitionToPlacement(roomId, "third")).toBeUndefined();
    expect(transitionToWaiting(roomId, "winner")).toBeUndefined();
    expect(
      transitionToPlaying(roomId, "winner", [createPlacedShip(1)] as (TShip & {
        type: "placed";
      })[]),
    ).toBeUndefined();
    expect(transitionToFinished(roomId, "winner")).toBeUndefined();

    cleanup(roomId);
  });
});
