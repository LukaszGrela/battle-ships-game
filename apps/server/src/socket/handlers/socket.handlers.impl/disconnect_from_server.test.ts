import { afterEach, describe, expect, it } from "vitest";
import { EGamePhase, IPlayer } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { WarRoom } from "../../../services/WarRoom";
import { factoryGetDisconnectFromServerHandler } from "./disconnect_from_server";
import { createIo, createSocket } from "./__tests/utils";

const activeGames = ActiveGameRegistrySingleton.getInstance();
const sessionService = ClientSessionServiceSingleton.getInstance();

const createPlayer = (
  id: string,
  name: string,
  owner = false,
  seed = id === "owner" ? 42 : 7,
): IPlayer => ({
  id,
  name,
  active: true,
  ready: false,
  owner,
  seed,
});

const createPlayingRoom = (id: string) => {
  const room = new WarRoom(id, `Room ${id}`, {
    ...createPlayer("owner", "Captain Black", true),
  });
  activeGames.addRoom(id, room);
  room.addPlayer(createPlayer("opponent", "Captain Red"));

  const game = (room as any).currentGame;
  game.phase = EGamePhase.Playing;
  game.updatePlayer({ id: "owner", active: true, ready: true });
  game.updatePlayer({ id: "opponent", active: true, ready: true });

  return room;
};

const cleanup = () => {
  activeGames.listRooms().forEach(({ id }) => activeGames.deleteRoom(id));
  ["owner", "opponent"].forEach((id) => sessionService.deleteSession(id));
};

describe("disconnect_from_server handler", () => {
  afterEach(cleanup);

  it("forfeits a playing game and clears the leaving player's gameId when the server disconnects them", () => {
    const room = createPlayingRoom("disconnect-server-room");

    const ownerSession = sessionService.createSession(
      "owner",
      1,
      "owner-socket",
    );
    ownerSession.name = "Captain Black";
    sessionService.updateSession("owner", ownerSession);

    const opponentSession = sessionService.createSession(
      "opponent",
      2,
      "opponent-socket",
    );
    opponentSession.name = "Captain Red";
    sessionService.updateSession("opponent", opponentSession);

    const ownerGameSession = sessionService.readSession("owner");
    if (!ownerGameSession) throw new Error("Missing owner session");
    ownerGameSession.gameId = room.id;
    sessionService.updateSession("owner", ownerGameSession);

    const io = createIo();
    const socket = createSocket("owner", "owner-socket");
    const handler = factoryGetDisconnectFromServerHandler(io, socket);

    handler();

    expect(room.getPhase()).toBe(EGamePhase.Finished);
    expect(room.getPlayer("owner")?.active).toBe(false);
    expect(sessionService.readSession("owner")?.gameId).toBeUndefined();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(io._toSpy).toHaveBeenCalledWith(
      "game_updated",
      expect.objectContaining({ phase: EGamePhase.Finished, id: room.id }),
    );
  });
});
