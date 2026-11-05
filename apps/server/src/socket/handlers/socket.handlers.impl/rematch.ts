import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { getSession } from "../../../security/auth";

type TRequestRematchHandler = IClientToServerEvents["request_rematch"];
type TAcceptRematchHandler = IClientToServerEvents["accept_rematch"];
type TRejectRematchHandler = IClientToServerEvents["reject_rematch"];

const warRoomFinder = (
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
  clientId: string,
) => {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
  const warRoomIdent = activeGameRegistry.findFinishedRoomForPlayer(clientId);
  if (!warRoomIdent) {
    console.log("[warRoomFinder] No finished game to rematch");
    socket.emit("error", "No finished game to rematch");
    return;
  }
  const warRoom = activeGameRegistry.getRoom(warRoomIdent.id);
  if (!warRoom) {
    console.log("[warRoomFinder] Finished game not found");
    socket.emit("error", "No finished game to rematch");
    return;
  }

  return warRoom;
};

export const factoryRequestRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TRequestRematchHandler => {
  return () => {
    const clientId = getSession(socket).playerId;

    const warRoom = warRoomFinder(socket, clientId);
    if (warRoom) {
      const rematchResult = warRoom.requestRematch(clientId);

      if (rematchResult < 1) {
        console.log(
          "[factoryRequestRematchHandler] Failed to request rematch",
          rematchResult,
        );
        // failure
        socket.emit("error", "Rematch request rejected");
      } else {
        // success
        socket.emit("game_updated", warRoom.getGameState(clientId));
      }

      const requestor = warRoom.getPlayer(clientId);
      const otherPlayer = warRoom.getOpponent(clientId);
      if (otherPlayer) {
        const sessionService = ClientSessionServiceSingleton.getInstance();
        const otherPlayerSession = sessionService.readSession(otherPlayer.id);
        if (otherPlayerSession) {
          io.to(otherPlayerSession.socketId).emit("rematch_requested", {
            requestorId: clientId,
            status: "pending",
            name: requestor?.name ?? "",
            seed: requestor?.seed ?? 0,
          });
        }
      }
    }
  };
};

export const factoryAcceptRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TAcceptRematchHandler => {
  return () => {
    const clientId = getSession(socket).playerId;

    const warRoom = warRoomFinder(socket, clientId);
    if (warRoom) {
      const acceptStatus = warRoom.acceptRematch(clientId);
      if (acceptStatus < 1) {
        console.log(
          "[factoryAcceptRematchHandler] Failed to accept rematch",
          acceptStatus,
        );
        socket.emit("error", "Rematch cannot be accepted");
        return;
      }

      const session = ClientSessionServiceSingleton.getInstance();
      const acceptor = warRoom.getPlayer(clientId);
      const requestor = warRoom.getOpponent(clientId);

      function updateSession(playerId: string | undefined, warRoomId: string) {
        const clientSession = playerId && session.readSession(playerId);
        if (playerId && clientSession) {
          clientSession.gameId = warRoomId;
          session.updateSession(playerId, clientSession);
        }
      }
      updateSession(acceptor?.id, warRoom.id);
      updateSession(requestor?.id, warRoom.id);

      io.to(warRoom.id).emit("rematch_accepted", {
        roomId: warRoom.id,
        status: "accepted",
      });

      emitRoomStateToPlayers(io, clientId, warRoom.id);
    }
  };
};

export const factoryRejectRematchHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TRejectRematchHandler => {
  return () => {
    const clientId = getSession(socket).playerId;

    const warRoom = warRoomFinder(socket, clientId);

    if (warRoom) {
      const rematchRequest = warRoom.getGameState(clientId)?.rematchRequest;
      const rejectResult = warRoom.rejectRematch(clientId);

      if (rejectResult < 1) {
        console.log(
          "[factoryRejectRematchHandler] Failed to reject rematch",
          rejectResult,
        );
        socket.emit("error", "Rematch cannot be rejected");
        return;
      }

      const requestorId = rematchRequest?.requestorId;
      if (!requestorId) {
        socket.emit("error", "Rematch cannot be rejected");
        return;
      }
      const requestorSession =
        ClientSessionServiceSingleton.getInstance().readSession(requestorId);
      if (requestorSession) {
        io.to(requestorSession.socketId).emit("rematch_rejected", {
          roomId: warRoom.id,
          requestorId,
          status: "rejected",
        });
      }

      emitRoomStateToPlayers(io, clientId, warRoom.id);
    }
  };
};
