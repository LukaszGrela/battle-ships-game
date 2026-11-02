import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomIdentity,
} from "@repo/types";
import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers2 } from "../../../utils/emitRoomStateToPlayers";
import { WarRoom } from "../../../services/WarRoom";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { playerHasAnotherActiveGame } from "../../../utils/playerHasAnotherActiveGame";
import { storeGameId } from "../../../utils/storeGameId";

type TJoinGameHandler = IClientToServerEvents["join_game"];

export const factoryJoinGameHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TJoinGameHandler => {
  return (roomIdentifier) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof roomIdentifier === "string"
        ? { name: roomIdentifier, id: nanoid() }
        : roomIdentifier;
    let clientSession = session.readSession(clientId);

    if (!clientSession) {
      socket.emit("error", "Invalid session");
      return;
    }

    let warRoom = activeGameRegistry.getRoom(roomId.id);

    if (!warRoom) {
      const firstPlayer = {
        id: clientId,
        active: true,
        ready: false,
        owner: true,
        name: clientSession.name,
        seed: clientSession.seed,
      };

      if (!playerHasAnotherActiveGame(clientId)) {
        warRoom = new WarRoom(roomId.id, roomId.name, firstPlayer);
        activeGameRegistry.addRoom(roomId.id, warRoom);

        if (storeGameId(firstPlayer.id, roomId.id)) {
          clientSession = session.readSession(clientId);
        }

        io.emit("open_games", activeGameRegistry.getOpenGames());
        emitStats(io);
      } else {
        socket.emit(
          "error",
          "Failed to create room, player has another active game.",
        );
      }
    } else if (warRoom && warRoom.playersCount < 2) {
      if (!playerHasAnotherActiveGame(clientId)) {
        const opponent = {
          id: clientId,
          active: true,
          ready: false,

          name: clientSession.name,
          seed: clientSession.seed,
        };

        if (!warRoom?.addPlayer(opponent)) {
          socket.emit("error", "Failed to join room.");
        } else {
          clientSession = session.readSession(clientId);
          // added 2nd player, game transitioned into placement
          const self = warRoom.getPlayer(clientId);
          const playerToNotify = warRoom.getOpponent(clientId);

          if (clientSession && self && playerToNotify) {
            // set session's game id
            if (storeGameId(clientSession.id, warRoom.id)) {
              clientSession = session.readSession(clientId);
            }

            const opponentSession = session.readSession(playerToNotify?.id);
            if (opponentSession && clientSession) {
              io.to(opponentSession.socketId).emit("opponent_connected", {
                name: clientSession.name,
                seed: clientSession.seed,
                owner: self.owner,
                ready: self.ready,
              });
            }
          } else {
            socket.emit("error", "Internal server error");
          }
        }
      } else {
        socket.emit(
          "error",
          "Failed to join room, player has another active game.",
        );
      }

      io.emit("open_games", activeGameRegistry.getOpenGames());
      emitStats(io);
    } else {
      socket.emit("error", "Room full");
      io.emit("open_games", activeGameRegistry.getOpenGames());
      emitStats(io);
      return;
    }

    if (
      warRoom &&
      warRoom.activatePlayer(clientId) &&
      clientSession &&
      clientSession.gameId
    ) {
      socket.join(roomId.id);
      socket.emit("welcome", clientId);
      emitRoomStateToPlayers2(io, clientId, clientSession.gameId);
    }
  };
};
