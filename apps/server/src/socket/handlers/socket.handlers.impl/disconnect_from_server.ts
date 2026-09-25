import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import { Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";

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
    if (clientSession) {
      if (clientSession.gameId) {
        const roomService = RoomServiceSingleton.getInstance();
        // find game and release it (send back to waiting) (or forfeit)
        const room = roomService.getRoom(clientSession.gameId);
        if (room) {
          // TODO: sort out game state
        }
      }
      // remove game id
      clientSession.gameId = undefined;
    }

    socket.disconnect(true);
  };
};
