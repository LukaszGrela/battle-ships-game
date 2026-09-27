import {
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import { isSunk } from "@repo/game-logic";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { emitStats } from "../../../utils/emitStats";
import { dataTampered } from "./data_tampered";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import {
  transitionToFinished,
  updateRoomWithNewTurnData,
} from "../../../utils/gameLifeCycle";

type TAttackCoordinateHandler = IClientToServerEvents["attack_coordinate"];

export const factoryAttackCoordinateHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TAttackCoordinateHandler => {
  return (coord) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }
    const roomService = RoomService.getInstance();
    let room = roomService.getRoom(clientSession.gameId);

    if (!room || room.turn !== clientId || room.phase !== "playing") {
      console.error("Not your turn", room?.turn, room?.phase, room);
      socket.emit("error", "Not your turn or game not active");
      return;
    }

    room = updateRoomWithNewTurnData(room.id, clientId, coord);

    if (!room) {
      return;
    }

    const opponent = getOtherPlayer(clientId, room.players);
    if (!opponent) {
      return;
    }

    const enemyFleet = room.ships[opponent.id];
    const enemyHasShips = enemyFleet?.some((ship) => !isSunk(ship));
    if (!enemyHasShips) {
      room = transitionToFinished(room.id, clientId);
      if (!room) {
        return;
      }

      emitStats(io);
    }

    emitRoomStateToPlayers(io, room);
  };
};
