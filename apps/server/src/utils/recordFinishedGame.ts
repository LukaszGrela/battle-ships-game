import ActiveGameRegistrySingleton from "../services/active-game-registry";
import GameStatsServiceSingleton, {
  buildRecordId,
  type IFinishedGamePlayer,
  type IRecordGameResult,
} from "../services/game-stats.service";

/**
 * Persists the battle that just ended in `roomId`, if any.
 *
 * Safe to call from every "room state might be finished now" path: a battle is
 * identified by `${roomId}#${battleIndex}`, so the broadcast choke point and
 * the room teardown can both call it and the game is still counted once.
 *
 * Call it **before** the room is deleted – the room is the only source of the
 * participant list.
 */
export const recordFinishedGame = (
  roomId: string,
): IRecordGameResult | undefined => {
  const warRoom = ActiveGameRegistrySingleton.getInstance().getRoom(roomId);
  if (!warRoom) return undefined;

  const summary = warRoom.getFinishedBattleSummary();
  if (!summary) return undefined;

  const id = buildRecordId(roomId, summary.battleIndex);
  if (GameStatsServiceSingleton.getInstance().hasGame(id)) {
    return undefined;
  }

  const players: IFinishedGamePlayer[] = warRoom.getPlayers().map((player) => ({
    id: player.id,
    name: player.name,
    botLevel: player.botLevel,
    result: player.id === summary.winnerId ? "win" : "lost",
  }));

  return GameStatsServiceSingleton.getInstance().recordGame({
    id,
    roomId,
    roomName: warRoom.name,
    battleIndex: summary.battleIndex,
    finishedAt: summary.finishedAt,
    byForfeit: summary.byForfeit,
    players,
    // Extension point: add rounds, duration, bot difficulty, sunk ships…
    meta: {
      winnerId: summary.winnerId,
      loserId: summary.loserId ?? null,
    },
  });
};
