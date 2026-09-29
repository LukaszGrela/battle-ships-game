import { afterEach, describe, expect, it, vi } from "vitest";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { dataTampered } from "./data_tampered";
import { createIo, createSocket } from "./__tests/utils";

const sessionService = ClientSessionServiceSingleton.getInstance();

describe("dataTampered", () => {
  afterEach(() => {
    ["tampered-client", "missing-client"].forEach((id) =>
      sessionService.deleteSession(id),
    );
  });

  it("emits a server error, clears the client session, and disconnects the socket", () => {
    const io = createIo();
    const socket = createSocket("tampered-client");
    sessionService.createSession("tampered-client", "tampered-client-socket");

    dataTampered(io, socket);

    expect(socket.emit).toHaveBeenCalledWith("error", "Internal server error");
    expect(socket.emit).toHaveBeenCalledWith("game_updated", null);
    expect(sessionService.readSession("tampered-client")).toBeNull();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("handles a client without a session without throwing", () => {
    const io = createIo();
    const socket = createSocket("missing-client");

    expect(() => dataTampered(io, socket)).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith("error", "Internal server error");
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
