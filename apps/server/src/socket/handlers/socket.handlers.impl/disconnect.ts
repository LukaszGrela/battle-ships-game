import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { DisconnectReason, Server, Socket } from "socket.io";
import ActiveUsersServiceSingleton from "../../../services/users.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import RoomServiceSingleton from "../../../services/room.service";
import { singleUser } from "../../../utils/singleUser";
import { setWaiting } from "../../../utils/setWaiting";
import { toGameState } from "../../../utils/toGameState";

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
      "[registerSocketHandlers]",
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
    const roomService = RoomServiceSingleton.getInstance();

    // TODO: we have session to handle, so do not remove user hastly
    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      if (room.phase === "playing") {
        // player abandoned game, finish it
        room.phase = "finished";
        // leave room
        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
        }
      } else if (room.phase === "placement") {
        // if last user left kill the room
        if (singleUser(room)) {
          console.log(
            "[on disconnect] placement, single user, delete",
            room.id,
          );

          roomService.deleteRoom(room.id);
          io.emit("open_games", roomService.getOpenGames());
          return;
        } else {
          //
          setWaiting(io, socket);
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
      Object.keys(players).forEach((playerId) => {
        const playerSession = sessions.readSession(playerId);
        if (playerSession) {
          io.to(playerSession.socketId).emit(
            "game_updated",
            toGameState(playerId, roomService.getRoom(room.id)!),
          );
        }
      });
    }
    emitStats(io);
  };
