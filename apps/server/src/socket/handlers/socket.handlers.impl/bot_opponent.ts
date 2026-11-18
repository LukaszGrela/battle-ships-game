import {
  IClientToServerEvents,
  IServerToClientEvents,
  TBotDifficulty,
  TRoomIdentity,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { getSession } from "../../../security/auth";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { BotRunnerService, normalizeBotDifficulty } from "../../../bots";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { emitStats } from "../../../utils/emitStats";
import { closeGameRoom } from "../../../utils/roomLifecycle";

export const factoryBotOpponentHandler =
  (
    io: Server<IClientToServerEvents, IServerToClientEvents>,
    socket: Socket<IClientToServerEvents, IServerToClientEvents>,
  ) =>
  (
    payload: {
      roomIdentifier: Pick<TRoomIdentity, "id" | "name">;
      difficulty?: TBotDifficulty;
    },
    callback: (result: { ok: boolean; message?: string }) => void,
  ) => {
    const { roomIdentifier: roomId } = payload;
    const difficulty = normalizeBotDifficulty(payload.difficulty);
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
    const warRoom = activeGameRegistry.getRoom(roomId.id);
    if (!warRoom) {
      callback({ ok: false, message: "Room not found" });
      return;
    }
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = getSession(socket).playerId;
    let clientSession = session.readSession(clientId);

    if (!clientSession || clientSession.gameId !== roomId.id) {
      socket.emit("error", "Invalid session");
      callback({ ok: false, message: "Invalid session" });
      return;
    }

    if (!warRoom.hasPlayer(clientId)) {
      callback({ ok: false, message: "Not your room" });
      return;
    }

    if (warRoom.playersCount > 1) {
      callback({ ok: false, message: "Room already has an opponent" });
      return;
    }

    const bot = BotRunnerService.getInstance().spawnBot(roomId.id, difficulty);
    if (bot) {
      console.log("[bot_opponent] Bot created successfully.", bot);
      callback({ ok: true, message: "Game with bot created successfully." });

      emitRoomStateToPlayers(io, clientId, clientSession.gameId);
      // Room is no longer joinable (bot spawn moved it to `Placement`).
      io.emit("open_games", activeGameRegistry.getOpenGames());
      emitStats(io);
    } else {
      // dispose warRoom if bot creation failed
      socket.emit("error", "Failed to create bot opponent.");
      callback({ ok: false, message: "Failed to create bot opponent." });
      closeGameRoom(io, roomId.id, "bot-opponent/spawn-failed");
    }
  };
