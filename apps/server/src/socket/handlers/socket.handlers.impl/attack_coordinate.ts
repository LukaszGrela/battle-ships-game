import {
  ECellStatus,
  IClientToServerEvents,
  IHistoryEntry,
  IServerToClientEvents,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import {
  getCell,
  isSunk,
  resolveAttack,
  setCell,
} from "@repo/game-logic";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { toGameState } from "../../../utils/toGameState";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { emitStats } from "../../../utils/emitStats";
import { dataTampered } from "./data_tampered";

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
    const room = roomService.getRoom(clientSession.gameId);

    if (!room || room.turn !== clientId || room.phase !== "playing") {
      console.error("Not your turn", room?.turn, room?.phase, room);
      socket.emit("error", "Not your turn or game not active");
      return;
    }

    const opponentId = getOtherPlayer(clientId, room.players)?.id;
    if (!opponentId) return;

    const targetBoard = room.boards[opponentId];
    if (!targetBoard) {
      console.error(
        "Failed to retrieve game board for opponent id",
        opponentId,
      );
      return;
    }
    const cell = getCell(targetBoard, coord.x, coord.y);
    if (typeof cell === "number" && cell < 0) {
      console.error(
        "Failed to retrieve board cell",
        `Error code: ${cell}`,
        coord,
        targetBoard,
      );
      return;
    }

    if (
      cell === ECellStatus.Hit ||
      cell === ECellStatus.Destroyed ||
      cell === ECellStatus.Miss
    ) {
      return;
    }

    const attackResult = resolveAttack(targetBoard, coord);
    const result = setCell(targetBoard, coord.x, coord.y, attackResult);
    if (result < 0) {
      console.error("Failed to update board cell", coord, targetBoard);
      return;
    }

    const historyEntry: IHistoryEntry = {
      coords: coord,
      isSunk: false,
      result: attackResult,
      turn: clientId,
    };
    if (room.history.length === 0) {
      historyEntry.init = true;
    }

    const enemyFleet = room.ships[opponentId];
    if (enemyFleet && typeof cell === "number" && cell >= 0) {
      const index = enemyFleet.findIndex(({ id }) => id === cell);
      if (index >= 0) {
        const enemyShip = enemyFleet[index];
        if (enemyShip && enemyShip.type === "placed" && !isSunk(enemyShip)) {
          enemyShip.hits.push(coord);
          if (enemyShip.hits.length === enemyShip.size) {
            historyEntry.isSunk = true;
          }
        }
      }
    }

    const enemyHasShips = enemyFleet?.some((ship) => !isSunk(ship));
    if (!enemyHasShips) {
      historyEntry.finish = true;
      historyEntry.whoWon = clientId;
      room.phase = "finished";
      room.result = {
        [clientId]: "win",
        [opponentId]: "lost",
      };
      room.game_finished = new Date().toISOString();
      warRoomNames.releaseRoom(room.name);
      emitStats(io);
    } else {
      room.turn = opponentId;
    }

    room.history.push(historyEntry);
    roomService.saveRoom(room);

    const freshRoom = roomService.getRoom(room.id)!;
    Object.keys(freshRoom.players).forEach((playerId) => {
      const playerSession = session.readSession(playerId);
      if (playerSession) {
        io.to(playerSession.socketId).emit(
          "game_updated",
          toGameState(playerId, freshRoom),
        );
      }
    });
  };
};
