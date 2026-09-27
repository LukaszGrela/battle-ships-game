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
import {
  createWarRoom,
  transitionToPlacement,
} from "../../../utils/gameLifeCycle";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";

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
    let clientSession = session.readSession(clientId);

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
      console.log("[join_game] created room", room?.ships);
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else if (Object.keys(room.players).length < 2) {
      room = transitionToPlacement(room.id, clientId);
      if (!room) {
        socket.emit("error", "Failed to transition room to placement phase");
      } else {
        console.log("[join_game] joined room, advance to placement");
        // notify other player about opponent joining
        // client id is the new player
        // opponent is the existing player to be notified
        const userToNotifyId = Object.keys(room.players).find(
          (id) => id !== clientId,
        );
        const player = Object.values(room.players).find(
          (needle) => needle.id === clientId,
        );

        clientSession = session.readSession(clientId);
        if (userToNotifyId && player && clientSession) {
          const userToNotifySession = session.readSession(userToNotifyId);
          if (userToNotifySession) {
            io.to(userToNotifySession.socketId).emit("opponent_connected", {
              name: clientSession.name,
              seed: clientSession.seed,
              owner: player.owner,
              ready: player.ready,
            });
          }
        } else {
          console.error("[join_game] opponent not found, invalid state", {
            room,
            clientId,
          });
          socket.emit("error", "Internal server error");
        }
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
      emitRoomStateToPlayers(io, room);
    }
  };
};
