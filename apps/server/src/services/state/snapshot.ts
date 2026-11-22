import ActiveGameRegistrySingleton from "../active-game-registry";
import ClientSessionServiceSingleton from "../client-session.service";
import GameStatsServiceSingleton from "../game-stats.service";
import { warRoomNames } from "../WarRoomName.service";
import type { IStateSnapshot } from "./types";

/**
 * Reads the live in-memory state into a plain snapshot.
 *
 * Rooms are serialized with their own `serialize()` implementation, so the
 * snapshot format follows the game model instead of duplicating it. Sessions
 * and room names are plain values that `structuredClone` already makes safe.
 */
export const collectStateSnapshot = (): IStateSnapshot => {
  const registry = ActiveGameRegistrySingleton.getInstance();
  const sessions = ClientSessionServiceSingleton.getInstance();
  const stats = GameStatsServiceSingleton.getInstance();

  const rooms = registry.listRooms().flatMap((summary) => {
    const room = registry.getRoom(summary.id);
    if (!room) return [];

    return [
      {
        id: room.id,
        name: room.name,
        phase: room.getPhase() ?? "Unknown",
        data: room.serialize(),
      },
    ];
  });

  return {
    rooms,
    sessions: sessions.listSessions(),
    roomNames: warRoomNames.listClaimed(),
    gameStats: [...stats.allGames()],
  };
};
