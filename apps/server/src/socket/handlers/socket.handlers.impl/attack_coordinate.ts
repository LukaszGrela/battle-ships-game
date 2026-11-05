import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
  TCellStatusMiss,
  TCellStatusShipHit,
} from "@repo/types";
import { Server, Socket } from "socket.io";
import {
  isAttackResultFailure,
  isCellFailure,
  isDestroyedShipStatus,
} from "@repo/game-logic";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { emitStats } from "../../../utils/emitStats";
import { dataTampered } from "./data_tampered";
import { emitRoomStateToPlayers } from "../../../utils/emitRoomStateToPlayers";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";
import { getSession } from "../../../security/auth";

type TAttackCoordinateHandler = IClientToServerEvents["attack_coordinate"];

export const factoryAttackCoordinateHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TAttackCoordinateHandler => {
  return (coord, callback) => {
    const session = ClientSessionServiceSingleton.getInstance();

    const clientId = getSession(socket).playerId;
    
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      dataTampered(io, socket);
      return;
    }
    const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

    const warRoom = activeGameRegistry.getRoom(clientSession.gameId);
    if (
      !warRoom ||
      warRoom.getTurn() !== clientId ||
      warRoom.getPhase() !== EGamePhase.Playing
    ) {
      console.error(
        "Not your turn",
        warRoom?.getTurn(),
        warRoom?.getPhase(),
        warRoom,
      );
      socket.emit("error", "Not your turn or game not active");
      callback?.({
        ok: false,
        message: "Not your turn or game not active",
      });
      return;
    }
    const result = warRoom.attack(clientSession.id, coord);
    if (
      result == undefined ||
      isAttackResultFailure(result) ||
      isCellFailure(result)
    ) {
      if (result === -1101) {
        console.error("Cell already attacked", coord);
        callback?.({
          ok: false,
          message: "Cell already attacked",
        });
      } else {
        dataTampered(io, socket);
      }
      return;
    } else {
      //
      if (isDestroyedShipStatus(result)) {
        const ship = warRoom.identifyShip(clientSession.id, result);
        callback?.({
          ok: true,
          status: result,
          size: ship?.size ?? 0,
        });
      } else {
        callback?.({
          ok: true,
          status: result as TCellStatusShipHit | TCellStatusMiss,
        });
      }
    }

    emitStats(io);
    emitRoomStateToPlayers(io, clientSession.id, warRoom.id);
  };
};
