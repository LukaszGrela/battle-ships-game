import { Server, Socket } from "socket.io";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomState,
} from "@repo/types";
import { getOtherPlayer } from "./getOtherPlayer";
import { toGameState } from "./toGameState";
import RoomService from "../services/room.service";
import ClientSessionServiceSingleton from "../services/client-session.service";

export function setWaiting(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) {
  const session = ClientSessionServiceSingleton.getInstance();
  const clientId = socket.handshake.auth.clientId;
  const clientSession = session.readSession(clientId);

  if (!clientSession || !clientSession.gameId) return;
  const roomService = RoomService.getInstance();

  const room = roomService.getRoom(clientSession.gameId);
  if (!room) return;

  if (room.phase === "finished" || room.phase === "playing") {
    // can't transition to waiting
    return;
  }

  console.log("[setWaiting]", room);

  roomService.setWaiting(clientId);

  const other = getOtherPlayer(clientId, room.players)!;

  // notify other player
  const otherSession = session.readSession(other.id);
  if (otherSession) {
    io.to(otherSession.socketId).emit(
      "game_updated",
      toGameState(other.id, roomService.getRoom(room.id)!),
    );
  }
  // console.log("[setWaiting]open games", roomService.getOpenGames());
  // Notify other players about game becoming open
  io.emit("open_games", roomService.getOpenGames());
}
