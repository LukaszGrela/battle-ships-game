import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import {
  acceptRematch,
  rejectRematch,
  requestRematch,
} from "../../../utils/gameLifeCycle";
import { toGameState } from "../../../utils/toGameState";

type TRequestRematchHandler = IClientToServerEvents["request_rematch"];
type TAcceptRematchHandler = IClientToServerEvents["accept_rematch"];
type TRejectRematchHandler = IClientToServerEvents["reject_rematch"];

const findFinishedRoomIdForPlayer = (playerId: string) => {
  const roomService = RoomService.getInstance();

  const roomEntry = roomService.listRooms().find((roomIdentity) => {
    const room = roomService.getRoom(roomIdentity.id);
    return !!room && room.phase === "finished" && !!room.players[playerId];
  });

  return roomEntry?.id;
};

export const factoryRequestRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TRequestRematchHandler => {
  return () => {
    const clientId = socket.handshake.auth.clientId as string | undefined;
    if (!clientId) {
      socket.emit("error", "Invalid session");
      return;
    }

    const roomId = findFinishedRoomIdForPlayer(clientId);
    if (!roomId) {
      socket.emit("error", "No finished game to rematch");
      return;
    }

    const room = requestRematch(roomId, clientId);
    if (!room) {
      socket.emit("error", "Rematch request rejected");
      return;
    } else {
      socket.emit("game_updated", toGameState(clientId, room));
    }

    const otherPlayerId = Object.keys(room.players).find(
      (id) => id !== clientId,
    );
    if (!otherPlayerId) {
      return;
    }

    const sessionService = ClientSessionServiceSingleton.getInstance();
    const otherPlayerSession = sessionService.readSession(otherPlayerId);
    if (otherPlayerSession) {
      io.to(otherPlayerSession.socketId).emit("rematch_requested", {
        requestorId: clientId,
        status: "pending",
        name: room.players[clientId]?.name ?? "",
        seed: room.players[clientId]?.seed ?? 0,
      });
    }
  };
};

export const factoryAcceptRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TAcceptRematchHandler => {
  return () => {
    const clientId = socket.handshake.auth.clientId as string | undefined;
    if (!clientId) {
      socket.emit("error", "Invalid session");
      return;
    }

    const roomId = findFinishedRoomIdForPlayer(clientId);
    if (!roomId) {
      socket.emit("error", "No finished game to rematch");
      return;
    }

    const room = acceptRematch(roomId, clientId);
    if (!room) {
      socket.emit("error", "Rematch cannot be accepted");
      return;
    }

    const sessionService = ClientSessionServiceSingleton.getInstance();
    Object.keys(room.players).forEach((playerId) => {
      const playerSession = sessionService.readSession(playerId);
      if (playerSession) {
        playerSession.gameId = room.id;
        sessionService.updateSession(playerId, playerSession);
      }
    });

    io.to(room.id).emit("rematch_accepted", {
      roomId: room.id,
      status: "accepted",
    });

    emitRoomStateToPlayers(io, room);
  };
};

export const factoryRejectRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TRejectRematchHandler => {
  return () => {
    const clientId = socket.handshake.auth.clientId as string | undefined;
    if (!clientId) {
      socket.emit("error", "Invalid session");
      return;
    }

    const roomId = findFinishedRoomIdForPlayer(clientId);
    if (!roomId) {
      socket.emit("error", "No finished game to rematch");
      return;
    }

    const room = rejectRematch(roomId, clientId);
    if (!room) {
      socket.emit("error", "Rematch cannot be rejected");
      return;
    }

    const requestorId = room.rematchRequest?.requestorId ?? clientId;
    const requestorSession =
      ClientSessionServiceSingleton.getInstance().readSession(requestorId);
    if (requestorSession) {
      io.to(requestorSession.socketId).emit("rematch_rejected", {
        roomId: room.id,
        requestorId,
        status: "rejected",
      });
    }

    emitRoomStateToPlayers(io, room);
  };
};
