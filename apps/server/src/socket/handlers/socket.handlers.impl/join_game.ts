import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomIdentity,
} from "@repo/types";
import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { toGameState } from "../../../utils/toGameState";
import {
  createWarRoom,
  transitionToPlacement,
} from "../../../utils/gameLifeCycle";

type TJoinGameHandler = IClientToServerEvents["join_game"];

export const factoryJoinGameHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TJoinGameHandler => {
  return (roomIdentifier) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const roomService = RoomService.getInstance();
    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof roomIdentifier === "string"
        ? { name: roomIdentifier, id: nanoid() }
        : roomIdentifier;
    const clientSession = session.readSession(clientId);

    if (!clientSession) {
      socket.emit("error", "Invalid session");
      return;
    }

    let room = roomService.getRoom(roomId.id);
    console.group("[join_game]");
    console.log("clientId", clientSession);
    console.log("socket.id", socket.id);
    console.groupEnd();
    if (!room) {
      room = createWarRoom(roomId, clientId);
      if (!room) {
        socket.emit("error", "Failed to create room");
      }
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else if (Object.keys(room.players).length < 2) {
      room = transitionToPlacement(room.id, clientId);
      if (!room) {
        socket.emit("error", "Failed to transition room to placement phase");
      } else {
        Object.values(room.players).forEach((player) => {
          if (player.id !== clientId) {
            const otherSession = session.readSession(player.id);
            if (otherSession && clientSession) {
              io.to(otherSession.socketId).emit("opponent_connected", {
                name: clientSession.name,
                seed: clientSession.seed,
                owner: player.owner,
                ready: player.ready,
              });
            }
          }
        });
      }

      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else {
      socket.emit("error", "Room full");
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
      return;
    }

    if (room) {
      socket.join(roomId.id);
      socket.emit("welcome", clientId);
      Object.keys(room.players).forEach((playerId) => {
        const playerSession = session.readSession(playerId);
        if (playerSession) {
          io.to(playerSession.socketId).emit(
            "game_updated",
            toGameState(playerId, room!),
          );
        }
      });
    }
  };
};
