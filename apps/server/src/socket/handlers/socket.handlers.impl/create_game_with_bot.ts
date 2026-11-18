import { Server, Socket } from "socket.io";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
  TBotDifficulty,
  TRoomIdentity,
} from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { getSession } from "../../../security/auth";
import { nanoid } from "nanoid";
import { playerHasAnotherActiveGame } from "../../../utils/playerHasAnotherActiveGame";
import { WarRoom } from "../../../services/WarRoom";
import { storeGameId } from "../../../utils/storeGameId";
import { BotRunnerService, normalizeBotDifficulty } from "../../../bots";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { closeGameRoom } from "../../../utils/roomLifecycle";

export const factoryCreateGameWithBotHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  return (
    payload: { name: string; difficulty?: TBotDifficulty },
    callback: (result: {
      ok: boolean;
      roomId?: string;
      message?: string;
    }) => void,
  ) => {
    // The socket payload is `unknown` at runtime – never feed it straight
    // into `DIFFICULTY_DELAYS` (an unknown key crashes the handler).
    const difficulty = normalizeBotDifficulty(payload.difficulty);
    const roomId: Pick<TRoomIdentity, "id" | "name"> = {
      name: payload.name,
      id: nanoid(),
    };

    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = getSession(socket).playerId;

    let clientSession = session.readSession(clientId);

    if (!clientSession) {
      socket.emit("error", "Invalid session");
      callback({ ok: false, message: "Invalid session" });
      return;
    }

    const firstPlayer = {
      id: clientId,
      active: true,
      ready: false,
      owner: true,
      name: clientSession.name,
      seed: clientSession.seed,
    };

    if (!playerHasAnotherActiveGame(clientId)) {
      let warRoom = new WarRoom(roomId.id, roomId.name, firstPlayer);
      activeGameRegistry.addRoom(roomId.id, warRoom);

      console.log(
        "[create_game_with_bot] WarRoom created. Owner:",
        warRoom.getOwner(),
      );

      if (storeGameId(firstPlayer.id, roomId.id)) {
        clientSession = session.readSession(clientId);
      }
      if (
        !warRoom.activatePlayer(clientId) ||
        !clientSession ||
        !clientSession.gameId
      ) {
        socket.emit("error", "Failed to activate player in the room");
        callback({
          ok: false,
          message: "Failed to activate player in the room",
        });
        // Room + name + `gameId` must not survive a failed creation.
        closeGameRoom(io, roomId.id, "create-bot/activate-failed");
        return;
      }

      emitStats(io);
      socket.join(roomId.id);
      socket.emit("welcome", clientId);

      warRoom = activeGameRegistry.getRoom(roomId.id)!;

      console.log("WarRoom:", clientSession.gameId, warRoom.id, roomId.id);

      const bot = BotRunnerService.getInstance().spawnBot(
        roomId.id,
        difficulty,
      );

      warRoom = activeGameRegistry.getRoom(roomId.id)!;

      console.log("Bot WarRoom:", warRoom);

      if (bot) {
        console.log("[create_game_with_bot] Bot created successfully.", bot);
        callback({ ok: true, message: "Game with bot created successfully." });

        emitRoomStateToPlayers(io, clientId, clientSession.gameId);
        // The room left `Waiting` (bot spawn -> `Placement`), so it must
        // disappear from every open-games list right away.
        io.emit("open_games", activeGameRegistry.getOpenGames());
        emitStats(io);
      } else {
        // dispose warRoom if bot creation failed
        socket.emit("error", "Failed to create bot opponent.");
        callback({ ok: false, message: "Failed to create bot opponent." });
        closeGameRoom(io, roomId.id, "create-bot/spawn-failed");
      }
    } else {
      socket.emit(
        "error",
        "Failed to create room, player has another active game.",
      );
      callback({
        ok: false,
        message: "Failed to create room, player has another active game.",
      });
    }
  };
};
