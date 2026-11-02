import { EGamePhase, IPlayer, TCellStatusShipId, TShip } from "@repo/types";
import { ActiveGameRegistry } from "./active-game-registry.impl";
import { WarRoom } from "./WarRoom";

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: `Player ${id}`,
  seed: 1,
  active: true,
  ready: false,
  owner,
});

const createShips = (): (TShip & {
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

const createFinishedRoom = (id: string, name: string) => {
  const room = new WarRoom(id, name, createPlayer("owner", true));
  room.addPlayer(createPlayer("opponent"));
  room.placeShips("owner", createShips());
  room.placeShips("opponent", createShips());
  room.forfeit("owner");
  return room;
};

describe("ActiveGameRegistry", () => {
  describe("findFinishedRoomForPlayer", () => {
    it("returns room identity and timestamps when the player is in a finished room", () => {
      const registry = new ActiveGameRegistry();
      const room = createFinishedRoom("finished-room", "Finished Room");
      registry.addRoom(room.id, room);

      expect(room.getPhase()).toBe(EGamePhase.Finished);
      expect(registry.findFinishedRoomForPlayer("owner")).toEqual({
        id: room.id,
        name: room.name,
        phase: EGamePhase.Finished,
        ...room.getTimeStamps(),
      });
      expect(registry.findFinishedRoomForPlayer("opponent")).toEqual({
        id: room.id,
        name: room.name,
        phase: EGamePhase.Finished,
        ...room.getTimeStamps(),
      });
    });

    it("ignores rooms that are not finished and returns undefined for unknown players", () => {
      const registry = new ActiveGameRegistry();
      const waitingRoom = new WarRoom(
        "waiting-room",
        "Waiting Room",
        createPlayer("waiting-player", true),
      );
      registry.addRoom(waitingRoom.id, waitingRoom);
      registry.addRoom(
        "finished-room",
        createFinishedRoom("finished-room", "Finished Room"),
      );

      expect(
        registry.findFinishedRoomForPlayer("waiting-player"),
      ).toBeUndefined();
      expect(registry.findFinishedRoomForPlayer("unknown-player")).toBeUndefined();
    });

    it("returns the first matching finished room when a player has multiple", () => {
      const registry = new ActiveGameRegistry();
      const firstRoom = createFinishedRoom("first-room", "First Room");
      const secondRoom = createFinishedRoom("second-room", "Second Room");
      registry.addRoom(firstRoom.id, firstRoom);
      registry.addRoom(secondRoom.id, secondRoom);

      expect(registry.findFinishedRoomForPlayer("owner")).toMatchObject({
        id: "first-room",
        name: "First Room",
        phase: EGamePhase.Finished,
      });
    });
  });
});
