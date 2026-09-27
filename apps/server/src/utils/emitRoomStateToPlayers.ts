import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomState,
} from "@repo/types";
import { Server } from "socket.io";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { toGameState } from "./toGameState";

export function emitRoomStateToPlayers(
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  room: TRoomState,
  playerIdToSkip?: string,
): void {
  const session = ClientSessionServiceSingleton.getInstance();
  Object.keys(room.players).forEach((playerId) => {
    const playerSession = session.readSession(playerId);
    if (playerId === playerIdToSkip) {
      return;
    }
    if (playerSession) {
      io.to(playerSession.socketId).emit(
        "game_updated",
        toGameState(playerId, room),
      );
    }
  });
}
