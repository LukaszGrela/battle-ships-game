import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import { Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { finishRoomByForfeit } from "../../../utils/finishRoomByForfeit";

type THandler = IClientToServerEvents["disconnect_from_server"];

export const factoryGetDisconnectFromServerHandler = (
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): THandler => {
  return function getDisconnectFromServerHandler() {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId as string | undefined;

    const clientSession = sessions.readSession(clientId ?? "");

    console.log(
      "[registerSocketHandlers]",
      "disconnect_from_server",
      clientSession,
    );

    if (clientId && clientSession) {
      if (clientSession.gameId) {
        const roomService = RoomServiceSingleton.getInstance();
        // find game and release it (send back to waiting) (or forfeit)
        const room = roomService.getRoom(clientSession.gameId);
        if (room) {
          if (room.phase === "playing") {
            // forfeit the game
            finishRoomByForfeit(room.id, clientId!);
          }
        }
      }
      // remove game id
      clientSession.gameId = undefined;
      sessions.updateSession(clientId!, clientSession);
    }

    socket.disconnect(true);
  };
};
