import { createEmptyBoard } from "@repo/game-logic";
import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomIdentity,
} from "@repo/types";
import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import RoomService from "../../../services/room.service";
import ClientSessionServiceSingleton from "../../../services/client-session.service";
import { warRoomNames } from "../../../services/WarRoomName.service";
import { createNewRoom } from "../../../utils/createNewRoom";
import { emitStats } from "../../../utils/emitStats";
import { getOtherPlayer } from "../../../utils/getOtherPlayer";
import { getShips } from "../../../utils/getShips";
import { toGameState } from "../../../utils/toGameState";

type TJoinGameHandler = IClientToServerEvents["join_game"];

export const factoryJoinGameHandler = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
): TJoinGameHandler => {
  return (roomIdentifier) => {
    const session = ClientSessionServiceSingleton.getInstance();
    const clientId = socket.handshake.auth.clientId;
    const roomService = RoomService.getInstance();
    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof roomIdentifier === "string"
        ? { name: roomIdentifier, id: nanoid() }
        : roomIdentifier;
    const clientSession = session.readSession(clientId);

    if (!clientSession) {
      socket.emit("error", "Invalid session");
      return;
    }

    let room = roomService.getRoom(roomId.id);
    console.group("[join_game]");
    console.log("clientId", clientSession);
    console.log("socket.id", socket.id);
    console.groupEnd();
    if (!room) {
      room = createNewRoom(
        { ...roomId },
        {
          id: clientId,
          active: true,
          ready: false,
          owner: true,
          name: clientSession.name,
          seed: clientSession.seed,
        },
      );
      warRoomNames.claimRoom(roomId.name);
      roomService.saveRoom(room);
      clientSession.gameId = roomId.id;
      session.updateSession(clientId, clientSession);
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else if (Object.keys(room.players).length < 2) {
      room.boards[clientId] = createEmptyBoard();
      const anotherPlayer = {
        id: clientId,
        active: true,
        ready: false,
        name: clientSession.name,
        seed: clientSession.seed,
      };
      clientSession.gameId = roomId.id;
      session.updateSession(clientId, clientSession);
      room.players[clientId] = anotherPlayer;
      room.phase = "placement";
      room.ships = getShips(Object.keys(room.players), [5, 4, 3, 3, 2]);
      const other = getOtherPlayer(clientId, room.players);
      const otherSession = session.readSession(other?.id ?? "<unknown>");
      if (!other || !otherSession) {
        console.group("[join_game]");
        console.error("Can't match opponent");
        console.error("clientId", clientId);
        console.error("otherSession", otherSession);
        console.error("roomId", room.id, room.name, room.players);
        console.groupEnd();
        return;
      }
      roomService.saveRoom(room);
      io.to(otherSession.socketId).emit("opponent_connected", anotherPlayer.name);
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else {
      socket.emit("error", "Room full");
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
      return;
    }

    socket.join(roomId.id);
    socket.emit("welcome", clientId);
    Object.keys(room.players).forEach((playerId) => {
      const playerSession = session.readSession(playerId);
      if (playerSession) {
        io.to(playerSession.socketId).emit(
          "game_updated",
          toGameState(playerId, room!),
        );
      }
    });
  };
};
