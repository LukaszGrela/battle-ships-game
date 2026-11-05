import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Socket, Server } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import { getSession } from "../../../security/auth";

type THandler = IClientToServerEvents["disconnect_from_server"];

export const factoryGetDisconnectFromServerHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): THandler => {
  return function getDisconnectFromServerHandler() {
    const sessions = ClientSessionServiceSingleton.getInstance();

    const clientId = getSession(socket).playerId;

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
          if (
            warRoom.getPhase() === EGamePhase.Playing &&
            warRoom.forfeit(clientId)
          ) {
            // forfeit the game
            warRoomNames.releaseRoom(warRoom.name);
            emitRoomStateToPlayers(io, clientId, warRoom.id);
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
