import {
  ECellStatus,
  IClientToServerEvents,
  IServerToClientEvents,
  TAttackHistory,
  TRoomState,
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
  TUpdateRoomWithNewTurnDataStatus,
  updateRoomWithNewTurnData,
} from "../../../utils/gameLifeCycle";

type TAttackCoordinateHandler = IClientToServerEvents["attack_coordinate"];

export const factoryAttackCoordinateHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TAttackCoordinateHandler => {
  return (coord, callback) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }
    const roomService = RoomService.getInstance();
    let room: TRoomState | undefined | TUpdateRoomWithNewTurnDataStatus =
      roomService.getRoom(clientSession.gameId);

    if (!room || room.turn !== clientId || room.phase !== "playing") {
      console.error("Not your turn", room?.turn, room?.phase, room);
      socket.emit("error", "Not your turn or game not active");
      callback?.({
        ok: false,
        message: "Not your turn or game not active",
      });
      return;
    }

    room = updateRoomWithNewTurnData(room.id, clientId, coord);

    if (!room || typeof room === "number") {
      if (room === -7) {
        console.error("Cell already attacked", coord);
        callback?.({
          ok: false,
          message: "Cell already attacked",
        });
      } else {
        dataTampered(io, socket);
      }
      return;
    }

    const opponent = getOtherPlayer(clientId, room.players);
    if (!opponent) {
      return;
    }

    const enemyFleet = room.ships[opponent.id];
    const enemyHasShips = enemyFleet?.some((ship) => !isSunk(ship));

    const historyEntry = room.history.at(-1) as TAttackHistory;
    console.log(
      "[factoryAttackCoordinateHandler]",
      "historyEntry",
      historyEntry,
    );
    const callbackStatus = !historyEntry.isSunk
      ? historyEntry.result
      : ECellStatus.Destroyed;

    console.log(
      "[factoryAttackCoordinateHandler]",
      "callbackStatus",
      callbackStatus,
    );

    callback?.({
      ok: true,
      status: callbackStatus,
    });

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
