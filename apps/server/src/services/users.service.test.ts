import ActiveUsersServiceSingleton from "./users.service";
import { ActiveUsersService } from "./users.service.impl";

const createUsersService = () => new ActiveUsersService();

describe("services", () => {
  describe("ActiveUsersService", () => {
    it("starts with no active users", () => {
      const usersService = createUsersService();

      expect(usersService.countUsers()).toBe(0);
    });

    it("tracks unique active users", () => {
      const usersService = createUsersService();

      usersService.setUser("socket-1");
      usersService.setUser("socket-2");
      usersService.setUser("socket-1");

      expect(usersService.countUsers()).toBe(2);
    });

    it("iterates over each active user", () => {
      const usersService = createUsersService();
      usersService.setUser("socket-1");
      usersService.setUser("socket-2");
      usersService.setUser("socket-1");
      const visitedUsers: string[] = [];

      usersService.forEach((userId) => visitedUsers.push(userId));

      expect(visitedUsers).toEqual(["socket-1", "socket-2"]);
    });

    it("removes an active user", () => {
      const usersService = createUsersService();
      usersService.setUser("socket-1");
      usersService.setUser("socket-2");

      expect(usersService.removeUser("socket-1")).toBe(true);
      expect(usersService.countUsers()).toBe(1);
      expect(usersService.removeUser("missing-socket")).toBe(false);
    });

    it("returns false when removing the same user twice", () => {
      const usersService = createUsersService();
      usersService.setUser("socket-1");

      expect(usersService.removeUser("socket-1")).toBe(true);
      expect(usersService.removeUser("socket-1")).toBe(false);
      expect(usersService.countUsers()).toBe(0);
    });
  });

  describe("ActiveUsersServiceSingleton", () => {
    it("returns the same instance from getInstance", () => {
      const instance = ActiveUsersServiceSingleton.getInstance();

      expect(ActiveUsersServiceSingleton.getInstance()).toBe(instance);
    });
  });
});
