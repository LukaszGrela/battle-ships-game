import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import { Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { finishRoomByForfeit } from "../../../utils/finishRoomByForfeit";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";

type THandler = IClientToServerEvents["disconnect_from_server"];

export const factoryGetDisconnectFromServerHandler = (
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): THandler => {
  return function getDisconnectFromServerHandler() {
    const sessions = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId as string | undefined;

    const clientSession = sessions.readSession(clientId ?? "");

    console.log(
      "[factoryGetDisconnectFromServerHandler]",
      "disconnect_from_server",
      clientSession,
    );

    if (clientId && clientSession) {
      if (clientSession.gameId) {
        const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();
        if (activeGameRegistry.hasRoom(clientSession.gameId)) {
          const warRoom = activeGameRegistry.getRoom(clientSession.gameId)!;
          if (warRoom.getPhase() === EGamePhase.Playing) {
            // forfeit the game
            // finishRoomByForfeit(room.id, clientId!);
            console.log(
              "[factoryGetDisconnectFromServerHandler]",
              `TODO: warRoom.forfeit();`,
            );
          }
        }

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
