import { IClientSession } from "@repo/types";
import ClientSessionServiceSingleton from "./client-session.service";
import { ClientSessionService } from "./client-session.service.impl";

const createSessionService = () => new ClientSessionService();

describe("services", () => {
  describe("ClientSessionService", () => {
    it("creates and reads a session", () => {
      const sessionService = createSessionService();

      const session = sessionService.createSession(
        "client-id",
        "socket-id",
        "game-id",
      );

      expect(session).toEqual({
        id: "client-id",
        socketId: "socket-id",
        gameId: "game-id",
        name: expect.any(String),
        seed: expect.any(Number),
      });
      expect(sessionService.readSession("client-id")).toEqual(session);
    });

    it("creates a session without a game id", () => {
      const sessionService = createSessionService();

      const session = sessionService.createSession("client-id", "socket-id");

      expect(session.gameId).toBeUndefined();
      expect(sessionService.readSession("missing-id")).toBeNull();
    });

    it("returns the existing session when creating a duplicate id", () => {
      const sessionService = createSessionService();
      const session = sessionService.createSession("client-id", "socket-id");

      const duplicate = sessionService.createSession(
        "client-id",
        "replacement-socket-id",
        "game-id",
      );

      expect(duplicate).toBe(session);
      expect(sessionService.readSession("client-id")).toEqual(session);
    });

    it("updates an existing session", () => {
      const sessionService = createSessionService();
      const session = sessionService.createSession("client-id", "socket-id");
      const updatedSession: IClientSession = {
        ...session,
        socketId: "replacement-socket-id",
        gameId: "game-id",
      };

      expect(sessionService.updateSession("client-id", updatedSession)).toBe(
        true,
      );
      expect(sessionService.readSession("client-id")).toEqual(updatedSession);
      expect(sessionService.updateSession("missing-id", updatedSession)).toBe(
        false,
      );
    });

    it("tracks disconnect timestamps and clears them when the game ends", () => {
      const sessionService = createSessionService();
      const session = sessionService.createSession("client-id", "socket-id");
      session.disconnectedAt = 1234;
      sessionService.updateSession("client-id", session);

      expect(sessionService.readSession("client-id")?.disconnectedAt).toBe(1234);
      expect(sessionService.clearSessionGame("client-id")).toBe(true);
      expect(sessionService.readSession("client-id")?.gameId).toBeUndefined();
      expect(sessionService.readSession("client-id")?.disconnectedAt).toBeUndefined();
    });

    it("deletes an existing session", () => {
      const sessionService = createSessionService();
      sessionService.createSession("client-id", "socket-id");

      expect(sessionService.deleteSession("client-id")).toBe(true);
      expect(sessionService.readSession("client-id")).toBeNull();
      expect(sessionService.deleteSession("client-id")).toBe(false);
    });
  });

  describe("ClientSessionServiceSingleton", () => {
    it("returns the same instance from getInstance", () => {
      const instance = ClientSessionServiceSingleton.getInstance();

      expect(ClientSessionServiceSingleton.getInstance()).toBe(instance);
    });
  });
});
