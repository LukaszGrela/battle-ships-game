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

    ActiveUsersServiceSingleton.getInstance().removeUser(socket.id);

    if (!clientId || !clientSession || !clientSession.gameId) {
      emitStats(io);
      return;
    }

    if (clientSession?.socketId !== socket.id) {
      // stale-socket guard
      emitStats(io);
      return;
    }

    const roomService = RoomServiceSingleton.getInstance();

    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      if (room.phase === "playing") {
        clientSession.disconnectedAt = Date.now();
        sessions.updateSession(clientId, clientSession);

        room.players[clientId]!.active = false;
        roomService.saveRoom(room);

      } else if (room.phase === "placement") {
        if (singleUser(room)) {
          console.log(
            "[on disconnect] placement, single user, delete",
            room.id,
          );
          destroyWarRoom(clientId);
          io.emit("open_games", roomService.getOpenGames());
          emitStats(io);

          return;
        }

        transitionToWaiting(room.id, clientId);
      } else if (room.phase === "waiting") {
        console.log("[on disconnect] waiting, delete", room.id);
        destroyWarRoom(clientId);
        io.emit("open_games", roomService.getOpenGames());
        emitStats(io);
        return;
      }
      const freshRoom = roomService.getRoom(clientSession.gameId);
      if (freshRoom) {
        emitRoomStateToPlayers(io, freshRoom);
      }
    }
    io.emit("open_games", roomService.getOpenGames());
    emitStats(io);
  };
