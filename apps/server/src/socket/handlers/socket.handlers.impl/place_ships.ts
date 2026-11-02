import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
  TCellStatusShipId,
  TShip,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { dataTampered } from "./data_tampered";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { emitRoomStateToPlayers2 } from "../../../utils/emitRoomStateToPlayers";

type TPlaceShipsHandler = IClientToServerEvents["place_ships"];

export const factoryPlaceShipsHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TPlaceShipsHandler => {
  return (ships: (TShip & { type: "pending" })[]) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const warRoom = activeGameRegistry.getRoom(clientSession.gameId);
    if (
      !warRoom ||
      warRoom.getPhase() !== EGamePhase.Placement ||
      !warRoom.hasPlayer(clientId)
    ) {
      console.error("no room or opponent, invalid state");
      dataTampered(io, socket);
      return;
    }

    if (
      warRoom.placeShips(
        clientId,
        ships as (TShip & { type: "pending"; id: TCellStatusShipId })[],
      )
    ) {
      // Ships placed successfully
      if (warRoom.getPhase() === EGamePhase.Playing) {
        // notify both players about game start
        emitRoomStateToPlayers2(io, clientId, warRoom.id);
      } else {
        // waiting for other player
        // opponent is not ready, just place ships, mark player as ready, and ...
        // ...notify opponent about player readiness
        const opponent = warRoom.getOpponent(clientId);
        if (!opponent) {
          console.error("Opponent not found");
          dataTampered(io, socket);
          return;
        }
        const opponentSession = session.readSession(opponent.id);
        const self = warRoom.getPlayer(clientId);
        if (opponentSession && self) {
          io.to(opponentSession.socketId).emit("player_ready", {
            id: self.id,
            name: self.name,
            seed: self.seed,
            owner: self.owner,
            ready: self.ready,
          });
        }

        // notify player about game state update
        emitRoomStateToPlayers2(io, clientId, warRoom.id, opponent.id);
      }
    }
  };
};
