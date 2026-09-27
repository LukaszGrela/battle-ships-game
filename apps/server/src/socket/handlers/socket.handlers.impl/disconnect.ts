import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { DisconnectReason, Server, Socket } from "socket.io";
import ActiveUsersServiceSingleton from "../../../services/users.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import RoomServiceSingleton from "../../../services/room.service";
import { singleUser } from "../../../utils/singleUser";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import {
  destroyWarRoom,
  transitionToWaiting,
} from "../../../utils/gameLifeCycle";
import { finishRoomByForfeit } from "../../../utils/finishRoomByForfeit";

type TDisconnectHandler = (reason: DisconnectReason) => void;

export const factoryDisconnectHandler =
  (
    io: Server<IClientToServerEvents, IServerToClientEvents>,
    socket: Socket<IClientToServerEvents, IServerToClientEvents>,
  ): TDisconnectHandler =>
  (reason: DisconnectReason) => {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId as string | undefined;

    const clientSession = sessions.readSession(clientId ?? "");

    // Logic: If player leaves, broadcast game_over or handle session
    console.log(
      "[factoryDisconnectHandler]",
      "Player disconnected",
      socket.id,
      "due to",
      reason,
    );

    if (clientSession?.socketId !== socket.id) {
      // stale-socket guard
      ActiveUsersServiceSingleton.getInstance().removeUser(socket.id);
      emitStats(io);
      return;
    }

    if (!clientId || !clientSession || !clientSession.gameId) {
      emitStats(io);
      return;
    }
    const roomService = RoomServiceSingleton.getInstance();

    // TODO: we have session to handle, so do not remove user hastly
    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      if (room.phase === "playing") {
        finishRoomByForfeit(room.id, clientId);
      } else if (room.phase === "placement") {
        // if last user left kill the room
        if (singleUser(room)) {
          console.log(
            "[on disconnect] placement, single user, delete",
            room.id,
          );
          destroyWarRoom(clientId);
          io.emit("open_games", roomService.getOpenGames());
          emitStats(io);

          return;
        } else {
          //
          transitionToWaiting(room.id, clientId);
        }
      } else if (room.phase === "waiting") {
        // there should only be one user anyway
        console.log("[on disconnect] waiting, delete", room.id);
        roomService.deleteRoom(room.id);
        io.emit("open_games", roomService.getOpenGames());
        return;
      }
      const players = roomService.getRoom(room.id)!.players;
      // notify other party
      // per player emit
      emitRoomStateToPlayers(io, room);
    }
    emitStats(io);
  };
