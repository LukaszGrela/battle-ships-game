import { MAX_COMBINATIONS } from "../utils/generateWarRoomName";
import { WarRoomNameService } from "./WarRoomName.service";

const createWarRoomNameService = () => new WarRoomNameService();

describe("services", () => {
  describe("WarRoomNameService", () => {
    it("generates an available war room name", () => {
      const service = createWarRoomNameService();

      const name = service.getAvailableName();

      expect(name).toMatch(/^[A-Za-z]+-[A-Za-z]+$/);
      expect(service.isFreeToClaim(name!)).toBe(true);
    });

    it("claims a free room name only once", () => {
      const service = createWarRoomNameService();

      expect(service.isFreeToClaim("Ocean-Clash")).toBe(true);
      expect(service.claimRoom("Ocean-Clash")).toBe(true);
      expect(service.isFreeToClaim("Ocean-Clash")).toBe(false);
      expect(service.claimRoom("Ocean-Clash")).toBe(false);
    });

    it("releases a claimed room name", () => {
      const service = createWarRoomNameService();

      service.claimRoom("Ocean-Clash");
      service.releaseRoom("Ocean-Clash");

      expect(service.isFreeToClaim("Ocean-Clash")).toBe(true);
      expect(service.claimRoom("Ocean-Clash")).toBe(true);
    });

    it("does not fail when releasing an unknown room name", () => {
      const service = createWarRoomNameService();

      expect(() => service.releaseRoom("missing-room")).not.toThrow();
      expect(service.isFreeToClaim("missing-room")).toBe(true);
    });

    it("returns null when all room name combinations are claimed", () => {
      const service = createWarRoomNameService();

      for (let index = 0; index < MAX_COMBINATIONS; index += 1) {
        expect(service.claimRoom(`room-${index}`)).toBe(true);
      }

      expect(service.getAvailableName()).toBeNull();
    });
  });
});
