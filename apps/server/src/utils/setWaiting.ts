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

export function setWaiting(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) {
  const roomService = RoomService.getInstance();

  const room = roomService.findRoomBySocketId(socket.id);
  if (!room) return;
  if (room.phase === "finished" || room.phase === "playing") {
    // can't transition to waiting
    return;
  }

  console.log("[setWaiting]", room);

  roomService.setWaiting(socket.id);

  const other = getOtherPlayer(socket.id, room.players)!;

  // notify other player
  io.to(other.id).emit(
    "game_updated",
    toGameState(other.id, roomService.getRoom(room.id)!),
  );
  // console.log("[setWaiting]open games", roomService.getOpenGames());
  // Notify other players about game becoming open
  io.emit("open_games", roomService.getOpenGames());
}
