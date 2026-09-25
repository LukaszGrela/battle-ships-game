import {
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { emitStats } from "../../../utils/emitStats";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { setWaiting } from "../../../utils/setWaiting";
import { toGameState } from "../../../utils/toGameState";

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

    const room = roomService.getRoom(clientSession.gameId);
    console.log("[leave_game]", "room", room);
    if (room) {
      if (room.phase === "waiting") {
        socket.emit("game_updated", null);
        roomService.deleteRoom(room.id);
        warRoomNames.releaseRoom(room.name);
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);
      } else if (room.phase === "placement") {
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);
        setWaiting(io, socket);
        socket.emit("game_updated", null);
      } else if (room.phase === "playing") {
        const other = getOtherPlayer(clientId, room.players)!;
        room.phase = "finished";
        room.result = { [clientId]: "lost", [other.id]: "win" };
        room.game_finished = new Date().toISOString();
        roomService.saveRoom(room);
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);
        Object.keys(room.players).forEach((playerId) => {
          const playerSession = session.readSession(playerId);
          if (playerSession) {
            io.to(playerSession.socketId).emit(
              "game_updated",
              toGameState(playerId, room),
            );
          }
        });
      } else {
        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
          roomService.saveRoom(room);
        }
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);
        Object.keys(room.players).forEach((playerId) => {
          const playerSession = session.readSession(playerId);
          if (playerSession) {
            io.to(playerSession.socketId).emit(
              "game_updated",
              toGameState(playerId, room),
            );
          }
        });
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
