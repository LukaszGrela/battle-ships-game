import {
  IClientToServerEvents,
  IServerToClientEvents,
  TShip,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import {
  isValidPlacement,
  placeShip,
} from "@repo/game-logic";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { toGameState } from "../../../utils/toGameState";
import { dataTampered } from "./data_tampered";

type TPlaceShipsHandler = IClientToServerEvents["place_ships"];

export const factoryPlaceShipsHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TPlaceShipsHandler => {
  return (ships) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const roomService = RoomService.getInstance();
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }

    const room = roomService.getRoom(clientSession.gameId);
    if (room) {
      if (room.phase !== "placement") {
        console.error("Wrong phase", room.phase, room);
        socket.emit("error", "Can't place ships now");
        return;
      }
      const board = room.boards[clientId];
      const expectedShips = room.ships[clientId];
      if (!board || !expectedShips) {
        console.error("No board or ships");
        dataTampered(io, socket);
      } else {
        if (expectedShips.length !== ships.length) {
          console.error(
            "Data tampered, expected ships length != incoming ships length",
          );
          dataTampered(io, socket);
          return;
        }

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
          .filter(Boolean) as TShip[];

        if (placedShips.length !== expectedShips.length) {
          console.error("Some ships are not placed.");
          dataTampered(io, socket);
          return;
        } else {
          const self = room.players[clientId]!;
          room.ships[clientId] = placedShips;
          self.ready = true;
          const opponentId = getOtherPlayer(clientId, room.players)?.id;

          if (opponentId) {
            if (room.players[opponentId]!.ready) {
              room.phase = "playing";
              room.game_started = new Date().toISOString();
            } else {
              const opponentSession = session.readSession(opponentId);
              if (opponentSession) {
                io.to(opponentSession.socketId).emit("player_ready", {
                  name: self.name,
                  seed: self.seed,
                  owner: self.owner,
                  ready: self.ready,
                });
              }
            }
          }
        }
        roomService.saveRoom(room);
        if (room.phase === "placement") {
          socket.emit("game_updated", toGameState(clientId, room));
        } else {
          Object.keys(room.players).forEach((playerId) => {
            const playerSession = session.readSession(playerId);
            if (playerSession) {
              io.to(playerSession.socketId).emit(
                "game_updated",
                toGameState(playerId, room),
              );
            }
          });
        }
      }
    } else {
      console.error("no room, invalid state");
      socket.emit("error", "Internal server error");
      socket.emit("game_updated", null);
    }
  };
};
