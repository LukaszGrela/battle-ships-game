import {
  getPirateyName,
  getPirateyRoomName,
  getShortPirateName,
} from "./getPirateyName";

const expectPirateName = (name: string) => {
  expect(name).toMatch(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/);
  expect(name).not.toBe("");
};

describe("utils", () => {
  describe("getPirateyName", () => {
    it("returns the same name for the same seed", () => {
      const seed = 1979;

      expect(getPirateyName(seed)).toBe(getPirateyName(seed));
    });

    it("returns a formatted name for a seeded call", () => {
      const name = getPirateyName(1979);

      expectPirateName(name);
    });

    it("returns formatted names without a seed", () => {
      const names = Array.from({ length: 10 }, () => getPirateyName());

      names.forEach((name) => {
        expectPirateName(name);
      });
    });
  });

  describe("getShortPirateName", () => {
    it("returns the same short name for the same seed", () => {
      const seed = 1979;

      expect(getShortPirateName(seed)).toBe(getShortPirateName(seed));
    });

    it("returns formatted names with and without a seed", () => {
      expectPirateName(getShortPirateName(1979));

      Array.from({ length: 10 }, () => getShortPirateName()).forEach(
        expectPirateName,
      );
    });
  });

  describe("getPirateyRoomName", () => {
    it("returns a deterministic lowercase room slug for a seed", () => {
      const seed = 1979;
      const roomName = getPirateyRoomName(seed);

      expect(roomName).toBe(getPirateyRoomName(seed));
      expect(roomName).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });

    it("returns lowercase room slugs without a seed", () => {
      Array.from({ length: 10 }, () => getPirateyRoomName()).forEach(
        (roomName) => {
          expect(roomName).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
          expect(roomName).not.toBe("");
        },
      );
    });

    it("normalizes the seeded pirate name into the room name", () => {
      const seed = 1979;
      const pirateName = getPirateyName(seed);

      const expectedRoomName = pirateName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      expect(getPirateyRoomName(seed)).toBe(expectedRoomName);
    });
  });
});
