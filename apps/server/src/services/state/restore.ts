import type { Server } from "socket.io";
import {
  EGamePhase,
  IClientSession,
  IClientToServerEvents,
  IServerToClientEvents,
  TBotDifficulty,
} from "@repo/types";
import {
  FINISHED_ROOM_TTL_MS,
  closeGameRoom,
  scheduleFinishedRoomCleanup,
} from "../../utils/roomLifecycle";
import ActiveGameRegistrySingleton from "../active-game-registry";
import BotRunnerService from "../bot-runner";
import ClientSessionServiceSingleton from "../client-session.service";
import GameStatsServiceSingleton from "../game-stats.service";
import { warRoomNames } from "../WarRoomName.service";
import { WarRoom } from "../WarRoom";
import type {
  IBotStateRecord,
  IClosedRoomInfo,
  IRestoreReport,
  IRestoredRoomInfo,
  IStateSnapshot,
} from "./types";

type TGameServer = Server<IClientToServerEvents, IServerToClientEvents>;

const isBot = (player: { botLevel?: TBotDifficulty }) =>
  player.botLevel !== undefined;

/**
 * Brings a snapshot back into the live singletons.
 *
 * Order matters: rooms must exist before sessions and stats are attached,
 * because a session's `gameId` is only kept when its room survived, and the
 * finished-room cleanup timer can only be scheduled once the room is
 * registered. Nothing here talks to a socket; the caller grants the reconnect
 * grace afterwards.
 */
export const restoreStateSnapshot = (
  io: TGameServer,
  snapshot: IStateSnapshot,
  savedAt: string,
): IRestoreReport => {
  const registry = ActiveGameRegistrySingleton.getInstance();
  const sessions = ClientSessionServiceSingleton.getInstance();
  const stats = GameStatsServiceSingleton.getInstance();
  const botRunner = BotRunnerService.getInstance();

  // Grouped up front: a room may only resume with a driver for every bot player
  // it contains, otherwise the restored battle would freeze.
  const botRecords = new Map<string, IBotStateRecord[]>();
  for (const record of snapshot.bots ?? []) {
    const bucket = botRecords.get(record.roomId);
    if (bucket) bucket.push(record);
    else botRecords.set(record.roomId, [record]);
  }

  const now = Date.now();
  const rooms: IRestoredRoomInfo[] = [];
  const closedRooms: IClosedRoomInfo[] = [];
  const restoredIds = new Set<string>();
  let restoredBots = 0;

  for (const record of snapshot.rooms) {
    let room: WarRoom;

    try {
      room = WarRoom.deserialize(record.data);
    } catch (error) {
      console.warn(
        "[state] could not deserialize room, skipping",
        record.id,
        (error as Error).message,
      );
      closedRooms.push({
        id: record.id,
        name: record.name,
        reason: "restore-deserialize-error",
      });
      continue;
    }

    const players = room.getPlayers();
    const humans = players.filter((player) => !isBot(player));
    const botPlayers = players.filter(isBot);

    // A bot needs its saved brain, PRNG position and placement budget. Without
    // a matching record (`stage 1` snapshots, or a record for another player)
    // the room is closed instead of resuming a bot that cannot play its game.
    const roomBotRecords = botRecords.get(room.id) ?? [];
    const hasBotDriver = botPlayers.every((player) =>
      roomBotRecords.some((record) => record.bot.id === player.id),
    );

    if (botPlayers.length > 0 && !hasBotDriver) {
      closedRooms.push({
        id: room.id,
        name: room.name,
        reason: "restore-no-bot",
      });
      continue;
    }

    // A room without any human player has nobody to come back to.
    if (humans.length === 0) {
      closedRooms.push({
        id: room.id,
        name: room.name,
        reason: "restore-empty",
      });
      continue;
    }

    warRoomNames.claimRoom(room.name);

    const phase = room.getPhase() ?? EGamePhase.Waiting;
    // Rematch negotiations do not survive a restart: the deadline belongs to a
    // process that is gone and accepting would start a battle for players who
    // are not reconnected yet. Clearing it lets either side request again.
    const rematchReset =
      phase === EGamePhase.Finished ? room.resetRematchState() : false;

    registry.addRoom(room.id, room);

    try {
      for (const player of botPlayers) {
        const record = roomBotRecords.find(
          (candidate) => candidate.bot.id === player.id,
        )!;
        const restoredBot = botRunner.restoreBot(room.id, record.bot);
        if (!restoredBot) {
          throw new Error(`bot ${player.id} could not be re-attached`);
        }
      }
    } catch (error) {
      console.warn(
        "[state] could not restore bot driver, closing room",
        room.id,
        (error as Error).message,
      );
      // Releases the name, the bot(s) and the registry entry in one place.
      closeGameRoom(io, room.id, "restore-bot-error");
      closedRooms.push({
        id: room.id,
        name: room.name,
        reason: "restore-bot-error",
      });
      continue;
    }

    restoredIds.add(room.id);
    restoredBots += botPlayers.length;
    rooms.push({ id: room.id, name: room.name, phase, rematchReset });
  }

  let gameStats = 0;
  for (const record of snapshot.gameStats) {
    // `recordGame` is idempotent by record id, so a snapshot written twice can
    // not inflate the counters.
    if (stats.recordGame(record).recorded) gameStats += 1;
  }

  let restoredSessions = 0;
  for (const session of snapshot.sessions) {
    const gameId =
      session.gameId && restoredIds.has(session.gameId)
        ? session.gameId
        : undefined;

    const restored: IClientSession = {
      id: session.id,
      socketId: session.socketId,
      name: session.name,
      seed: session.seed,
      gameId,
      // The old socket died with the previous process. Stamping the disconnect
      // keeps the regular sweeper functional; the restart grace widens it so
      // nobody is forfeited before they can reconnect.
      disconnectedAt: gameId ? now : undefined,
    };

    sessions.createSession(
      restored.id,
      restored.seed,
      restored.socketId,
      restored.gameId,
    );
    sessions.updateSession(restored.id, restored);
    restoredSessions += 1;
  }

  for (const roomId of restoredIds) {
    if (registry.getRoom(roomId)?.getPhase() !== EGamePhase.Finished) continue;

    // The remaining lifetime is counted from the battle's own finish time, so a
    // restart does not extend the five-minute window a finished room gets.
    const room = registry.getRoom(roomId)!;
    const finishedAt = Date.parse(room.getTimeStamps().game_finished ?? "");
    const elapsed = Number.isFinite(finishedAt) ? now - finishedAt : 0;
    const remaining = FINISHED_ROOM_TTL_MS - elapsed;

    if (remaining > 0) {
      scheduleFinishedRoomCleanup(io, roomId, remaining);
    } else {
      closeGameRoom(io, roomId, "restore-ttl-expired");
    }
  }

  return {
    restored: true,
    savedAt,
    rooms,
    closedRooms,
    sessions: restoredSessions,
    gameStats,
    bots: restoredBots,
  };
};
