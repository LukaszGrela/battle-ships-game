import { EGamePhase, IPlayer, TCellStatusShipId, TShip } from "@repo/types";
import { WarRoom } from "./WarRoom";

const createPlayer = (id: string, owner = false): IPlayer => ({
  id,
  name: `${id}-name`,
  seed: id.length * 10,
  active: true,
  ready: false,
  owner,
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

const createFinishedWarRoom = () => {
  const room = new WarRoom("room-1", "Test Room", createPlayer("owner", true));
  room.addPlayer(createPlayer("opponent"));
  expect(room.placeShips("owner", createFleet())).toBe(true);
  expect(room.placeShips("opponent", createFleet())).toBe(true);
  expect(room.getPhase()).toBe(EGamePhase.Playing);
  expect(room.forfeit("owner")).toBe(true);
  expect(room.getPhase()).toBe(EGamePhase.Finished);
  return room;
};

describe("WarRoom", () => {
  describe("requestRematch", () => {
    it("rejects requests when the current game is not finished", () => {
      const room = new WarRoom(
        "room-1",
        "Test Room",
        createPlayer("owner", true),
      );

      expect(room.requestRematch("owner")).toBe(-1);
    });

    it("rejects a request from a player who is not in the finished game", () => {
      const room = createFinishedWarRoom();

      expect(room.requestRematch("unknown-player")).toBe(-2);
    });

    it("records a pending request and rejects a duplicate pending request", () => {
      const room = createFinishedWarRoom();

      expect(room.requestRematch("opponent")).toBe(1);
      expect(room.requestRematch("owner")).toBe(-3);
      expect(room.getGameState("owner")?.rematchRequest).toEqual({
        requestorId: "opponent",
        status: "pending",
        name: "opponent-name",
        seed: 80,
      });
    });

    it("rejects a new request after a previous request was rejected", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("opponent")).toBe(1);

      const serialized = JSON.parse(room.serialize());
      serialized.rematchRequest.status = "rejected";
      const restored = WarRoom.deserialize(JSON.stringify(serialized));

      expect(restored.requestRematch("owner")).toBe(-4);
    });
  });

  describe("rejectRematch", () => {
    it("returns an error when the game is not finished", () => {
      const room = new WarRoom(
        "room-1",
        "Test Room",
        createPlayer("owner", true),
      );

      expect(room.rejectRematch("owner")).toBe(-1);
    });

    it("rejects unknown players and requests when there is no pending rematch", () => {
      const room = createFinishedWarRoom();

      expect(room.rejectRematch("unknown-player")).toBe(-2);
      expect(room.rejectRematch("owner")).toBe(-3);
    });

    it("prevents the requestor from rejecting their own rematch request", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("opponent")).toBe(1);

      expect(room.rejectRematch("opponent")).toBe(-4);
      expect(room.getGameState("owner")?.rematchRequest?.status).toBe("pending");
    });

    it("marks a pending rematch request as rejected", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("opponent")).toBe(1);

      expect(room.rejectRematch("owner")).toBe(1);
      expect(room.getGameState("owner")?.rematchRequest).toEqual({
        requestorId: "opponent",
        status: "rejected",
        name: "opponent-name",
        seed: 80,
      });
      expect(room.rejectRematch("owner")).toBe(-3);
    });
  });

  describe("acceptRematch", () => {
    it("returns an error when the game is not finished", () => {
      const room = new WarRoom(
        "room-1",
        "Test Room",
        createPlayer("owner", true),
      );

      expect(room.acceptRematch("owner")).toBe(-1);
    });

    it("rejects unknown players and games without a pending request", () => {
      const room = createFinishedWarRoom();

      expect(room.acceptRematch("unknown-player")).toBe(-2);
      expect(room.acceptRematch("owner")).toBe(-3);
    });

    it("prevents the requestor from accepting their own rematch request", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("opponent")).toBe(1);

      expect(room.acceptRematch("opponent")).toBe(-4);
      expect(room.getPhase()).toBe(EGamePhase.Finished);
      expect(room.battlesPlayed).toBe(0);
    });

    it("starts a new placement game and preserves the accepted finished battle", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("owner")).toBe(1);

      expect(room.acceptRematch("opponent")).toBe(1);

      expect(room.getPhase()).toBe(EGamePhase.Placement);
      expect(room.playersCount).toBe(2);
      expect(room.battlesPlayed).toBe(1);
      expect(room.getPlayer("opponent")).toMatchObject({
        id: "opponent",
        ready: false,
        owner: true,
      });
      expect(room.getPlayer("owner")).toMatchObject({
        id: "owner",
        ready: false,
      });
      expect(room.getPlayer("owner")?.owner).toBeUndefined();

      const serialized = JSON.parse(room.serialize()) as {
        battles: string[];
        rematchRequest?: unknown;
      };
      const previousBattle = JSON.parse(serialized.battles[0]!) as {
        phase: EGamePhase;
        rematchRequest: {
          requestorId: string;
          status: string;
          name: string;
          seed: number;
        };
      };

      expect(previousBattle.phase).toBe(EGamePhase.Finished);
      expect(previousBattle.rematchRequest).toEqual({
        requestorId: "owner",
        status: "accepted",
        name: "owner-name",
        seed: 50,
      });
      expect(serialized.rematchRequest).toBeUndefined();
    });
  });

  describe("serialization", () => {
    it("preserves a pending rematch request when the room is serialized and restored", () => {
      const room = createFinishedWarRoom();
      expect(room.requestRematch("opponent")).toBe(1);

      const restored = WarRoom.deserialize(room.serialize());

      expect(restored.id).toBe(room.id);
      expect(restored.name).toBe(room.name);
      expect(restored.getPhase()).toBe(EGamePhase.Finished);
      expect(restored.getGameState("owner")?.rematchRequest).toEqual({
        requestorId: "opponent",
        status: "pending",
        name: "opponent-name",
        seed: 80,
      });
      expect(restored.requestRematch("owner")).toBe(-3);
    });
  });
});
