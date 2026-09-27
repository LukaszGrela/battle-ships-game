import {
  IClientToServerEvents,
  IServerToClientEvents,
  TShip,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import { isValidPlacement, placeShip } from "@repo/game-logic";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { toGameState } from "../../../utils/toGameState";
import { dataTampered } from "./data_tampered";
import {
  applyShipsAndMarkReady,
  transitionToPlaying,
} from "../../../utils/gameLifeCycle";

type TPlaceShipsHandler = IClientToServerEvents["place_ships"];

export const factoryPlaceShipsHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TPlaceShipsHandler => {
  return (ships: (TShip & { type: "pending" })[]) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const roomService = RoomService.getInstance();
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }

    let room = roomService.getRoom(clientSession.gameId);
    const opponent = getOtherPlayer(clientId, room?.players ?? {});

    if (room && opponent) {
      const board = room.boards[clientId];
      if (!board) {
        dataTampered(io, socket);
        return;
      }

      const expectedShips = room.ships[clientId];
      const placedShips = ships
        .map((ship) => {
          if (ship.coords && ship.orientation) {
            if (!isValidPlacement(board, ship.coords, ship, ship.orientation)) {
              return null;
            }
            placeShip(board, ship.coords, ship, ship.orientation);
            return {
              type: "placed",
              coords: ship.coords,
              hits: [],
              id: ship.id,
              orientation: ship.orientation,
              size: ship.size,
            } as TShip;
          }
        })
        .filter(Boolean) as (TShip & { type: "placed" })[];

      if (expectedShips?.length !== placedShips.length) {
        console.error("Some ships are not placed.");
        dataTampered(io, socket);
        return;
      }

      // opponent is ready, transition to playing phase
      if (opponent.ready) {
        room = transitionToPlaying(room.id, clientId, placedShips);
        if (!room) {
          dataTampered(io, socket);
          return;
        }
        // notify both players about game start
        Object.keys(room.players).forEach((playerId) => {
          const playerSession = session.readSession(playerId);
          if (playerSession) {
            io.to(playerSession.socketId).emit(
              "game_updated",
              toGameState(playerId, room!),
            );
          }
        });
      } else {
        // opponent is not ready, just place ships, mark player as ready, and ...
        room = applyShipsAndMarkReady(room.id, clientId, placedShips);
        if (!room) {
          dataTampered(io, socket);
          return;
        }
        // ...notify opponent about player readiness
        const opponentSession = session.readSession(opponent.id);
        const self = room.players[clientId];
        if (opponentSession && self) {
          io.to(opponentSession.socketId).emit("player_ready", {
            name: self.name,
            seed: self.seed,
            owner: self.owner,
            ready: self.ready,
          });
        }

        // notify player about game state update
        socket.emit("game_updated", toGameState(clientId, room));
      }
    } else {
      console.error("no room or opponent, invalid state");
      dataTampered(io, socket);
    }
  };
};
