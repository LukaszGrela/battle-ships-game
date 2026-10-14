import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { finishRoomByForfeit } from "../../../utils/finishRoomByForfeit";
import {
  destroyWarRoom,
  transitionToWaiting,
} from "../../../utils/gameLifeCycle";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { getPlayerById } from "../../../utils/getPlayerById";

type TLeaveGameHandler = IClientToServerEvents["leave_game"];

export const factoryLeaveGameHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TLeaveGameHandler => {
  return () => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const roomService = RoomService.getInstance();
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      socket.emit(
        "error",
        "Invalid session or game state. Can't leave a game, you're not joined.",
      );
      return;
    }

    let room = roomService.getRoom(clientSession.gameId);
    console.log("[leave_game]", "room", room?.phase, room?.players);
    if (room) {
      if (room.phase === "waiting") {
        destroyWarRoom(clientId);
        socket.emit("game_updated", null);
      } else if (room.phase === "placement") {
        transitionToWaiting(room.id, clientId);
        socket.emit("game_updated", null);
      } else if (room.phase === "playing") {
        room = finishRoomByForfeit(room.id, clientId);
        if (room) {
          emitRoomStateToPlayers(io, room);
        }
      } else if (room.phase === "finished") {
        // notify opponent that the player has left the game, in case they are waiting for a rematch or something
        const opponentId = getOtherPlayer(clientId, room.players);
        const self = getPlayerById(clientId, room.players);

        if (opponentId) {
          const opponentSession = session.readSession(opponentId.id);
          if (
            opponentId.active &&
            opponentSession &&
            opponentSession.socketId
          ) {
            io.to(opponentSession.socketId).emit(
              "player_left",
              self && {
                seed: self.seed,
                name: self.name,
                id: self.id,
              },
            );
          }
        }

        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
          roomService.saveRoom(room);
        }

        // clear session for leaving player players
        session.clearSessionGame(clientId);

        return;
      } else {
        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
          roomService.saveRoom(room);
        }
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);

        emitRoomStateToPlayers(io, room);
      }
    } else {
      clientSession.gameId = undefined;
      session.updateSession(clientId, clientSession);
      socket.emit("error", "No game to leave");
    }

    io.emit("open_games", roomService.getOpenGames());
    emitStats(io);
  };
};
