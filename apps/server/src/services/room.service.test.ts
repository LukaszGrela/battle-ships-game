import { EGamePhase, IPlayer, TRoomState } from "@repo/types";
import RoomServiceSingleton from "./room.service";
import { RoomService } from "./room.service.impl";

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
  phase: TRoomState["phase"] = EGamePhase.Waiting,
): TRoomState => {
  const owner = createPlayer("owner", true);
  const opponent = createPlayer("opponent");

  return {
    id,
    name: `${id}-name`,
    game_created: "2026-09-25T00:00:00.000Z",
    game_started:
      phase === EGamePhase.Waiting ? null : "2026-09-25T00:01:00.000Z",
    game_finished:
      phase === EGamePhase.Finished ? "2026-09-25T00:02:00.000Z" : null,
    history: [],
    result:
      phase === EGamePhase.Finished ? { owner: "win", opponent: "lost" } : {},
    phase,
    players: {
      [owner.id]: owner,
      [opponent.id]: opponent,
    },
    boards: {
      [owner.id]: [],
      [opponent.id]: [],
    },
    ships: {
      [owner.id]: [],
      [opponent.id]: [],
    },
    turn: owner.id,
  };
};

const createRoomService = () => new RoomService();

describe("services", () => {
  describe("RoomService", () => {
    it("saves and retrieves an isolated copy of a room", () => {
      const roomService = createRoomService();
      const room = createRoom("save-room");
      roomService.saveRoom(room);

      const storedRoom = roomService.getRoom(room.id);
      expect(storedRoom).toEqual(room);

      storedRoom!.players.owner!.name = "changed-name";
      expect(roomService.getRoom(room.id)!.players.owner!.name).toBe(
        "owner-name",
      );
    });

    it("returns undefined for an unknown room and deletes saved rooms", () => {
      const roomService = createRoomService();
      const room = createRoom("delete-room");

      expect(roomService.getRoom(room.id)).toBeUndefined();
      roomService.saveRoom(room);
      expect(roomService.deleteRoom(room.id)).toBe(true);
      expect(roomService.deleteRoom(room.id)).toBe(false);
      expect(roomService.getRoom(room.id)).toBeUndefined();
    });

    it("finds only active rooms for a player", () => {
      const roomService = createRoomService();
      const room = createRoom("find-room");
      room.players.opponent!.active = false;
      roomService.saveRoom(room);

      expect(roomService.findRoomByPlayerId("owner")?.id).toBe(room.id);
      expect(roomService.findRoomByPlayerId("opponent")).toBeUndefined();
      expect(roomService.findRoomByPlayerId("missing")).toBeUndefined();
    });

    it("lists rooms and returns only waiting rooms as open games", () => {
      const roomService = createRoomService();
      const waitingRoom = createRoom("waiting-room", EGamePhase.Waiting);
      const playingRoom = createRoom("playing-room", EGamePhase.Playing);
      roomService.saveRoom(waitingRoom);
      roomService.saveRoom(playingRoom);

      expect(roomService.listRooms()).toEqual([
        expect.objectContaining({
          id: waitingRoom.id,
          name: waitingRoom.name,
          phase: EGamePhase.Waiting,
        }),
        expect.objectContaining({
          id: playingRoom.id,
          name: playingRoom.name,
          phase: EGamePhase.Playing,
        }),
      ]);
      expect(roomService.getOpenGames()).toEqual([
        expect.objectContaining({ id: waitingRoom.id }),
      ]);
    });

    it("moves a player back to waiting and promotes the remaining player", () => {
      const roomService = createRoomService();
      const room = createRoom("set-waiting-room", EGamePhase.Placement);
      roomService.saveRoom(room);

      roomService.setWaiting("owner");

      const updatedRoom = roomService.getRoom(room.id)!;
      expect(updatedRoom.phase).toBe(EGamePhase.Waiting);
      expect(updatedRoom.turn).toBe("opponent");
      expect(updatedRoom.players).toEqual({
        opponent: expect.objectContaining({ owner: true }),
      });
      expect(updatedRoom.boards).toEqual({ opponent: [] });
      expect(updatedRoom.ships).toEqual({});
    });

    it("counts active and finished games", () => {
      const roomService = createRoomService();
      roomService.saveRoom(createRoom("waiting-room", EGamePhase.Waiting));
      roomService.saveRoom(createRoom("placement-room", EGamePhase.Placement));
      roomService.saveRoom(createRoom("playing-room", EGamePhase.Playing));
      roomService.saveRoom(createRoom("finished-room", EGamePhase.Finished));

      expect(roomService.activeGames()).toBe(2);
      expect(roomService.playedGames()).toBe(1);
    });
    describe("implements Singleton", () => {
      it("getInstance", () => {
        const instance = RoomServiceSingleton.getInstance();

        expect(RoomServiceSingleton.getInstance()).toBe(instance);
      });
    });
  });
});
