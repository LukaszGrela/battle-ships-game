import { DisconnectReason, Server, Socket } from "socket.io";
import { registerRoomHandlers } from "./handlers/room.handlers";
import { registerGameHandlers } from "./handlers/game.handlers";
import RoomService from "../services/room.service";
import { singleUser } from "../utils/singleUser";
import {
  EGamePhase,
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
import { toGameState } from "../utils/toGameState";
import { setWaiting } from "../utils/setWaiting";
import { warRoomNames } from "../services/WarRoomName.service";
import { emitStats } from "../utils/emitStats";
import ActiveUsersServiceSingleton from "../services/users.service";
import ClientSessionServiceSingleton from "../services/client-session.service";
import { getWarRoomNameHandler } from "./handlers/socket.handlers.impl/get_war_room_name";
import { getRoomsHandler } from "./handlers/socket.handlers.impl/get_rooms";
import { factoryGetDisconnectFromServerHandler } from "./handlers/socket.handlers.impl/disconnect_from_server";
import { factoryDisconnectHandler } from "./handlers/socket.handlers.impl/disconnect";

export const registerSocketHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const roomService = RoomService.getInstance();
  const sessions = ClientSessionServiceSingleton.getInstance();

  const clientId = socket.handshake.auth.clientId;

  if (!clientId || typeof clientId !== "string") {
    // invalid connection
    socket.disconnect(true);
    return;
  }

  const existing = sessions.readSession(clientId);
  if (existing) {
    existing.socketId = socket.id;

    // check if session has a game id
    if (existing.gameId) {
      // find room
      if (!roomService.getRoom(existing.gameId)) {
        // if not found remove id
        existing.gameId = undefined;
      }
    }

    // store changes
    sessions.updateSession(clientId, existing);
    socket.emit("session_restored", existing);
  } else {
    sessions.createSession(clientId, socket.id);

    socket.emit("session_created");
  }

  ActiveUsersServiceSingleton.getInstance().setUser(socket.id);

  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);

  // const rooms = roomService.listRooms();

  const openGames = roomService.getOpenGames();

  // in the lobby - send open games
  io.emit("open_games", openGames);

  if (existing && existing.gameId && roomService.getRoom(existing.gameId)) {
    // send notification with game update, so the user reconnects to the game
    socket.emit(
      "game_updated",
      toGameState(clientId, roomService.getRoom(existing.gameId)!),
    );
  } else {
    // send null game_updated for stale state
    socket.emit("game_updated", null);
  }

  console.log(
    "[STATS] active users",
    ActiveUsersServiceSingleton.getInstance().countUsers(),
  );

  emitStats(io);

  //
  socket.on("get_rooms", getRoomsHandler);
  socket.on("get_war_room_name", getWarRoomNameHandler);

  // user used disconnect button
  socket.on(
    "disconnect_from_server",
    factoryGetDisconnectFromServerHandler(socket),
  );

  // user has disonnected for some other reason
  socket.on("disconnect", factoryDisconnectHandler(io, socket));
};
