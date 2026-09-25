import { Server, Socket } from "socket.io";
import RoomService from "../../services/room.service";
import {
  IClientToServerEvents,
  IServerToClientEvents,
  TRoomIdentity,
} from "@repo/types";
import { getOtherPlayer } from "../../utils/getOtherPlayer";
import { toGameState } from "../../utils/toGameState";
import { warRoomNames } from "../../services/WarRoomName.service";
import { getShips } from "../../utils/getShips";
import { createEmptyBoard } from "@repo/game-logic";
import { createNewRoom } from "../../utils/createNewRoom";
import { nanoid } from "nanoid";
import { setWaiting } from "../../utils/setWaiting";
import { emitStats } from "../../utils/emitStats";
import ClientSessionServiceSingleton from "../../services/client-session.service";

export const registerRoomHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  const session = ClientSessionServiceSingleton.getInstance();

  const clientId = socket.handshake.auth.clientId;

  if (
    !clientId ||
    typeof clientId !== "string" ||
    session.readSession(clientId) === null
  ) {
    // invalid connection
    socket.disconnect();
    return;
  }

  // TODO: WIP
  socket.on("rejoin_game", () => {
    const clientSession = session.readSession(clientId);
    console.log("rejoin_game not implemented", clientSession);
    socket.emit("error", "Method rejoin_game not implemented!");
  });

  socket.on("join_game", (roomIdentifier) => {
    const roomService = RoomService.getInstance();
    const roomId: Pick<TRoomIdentity, "id" | "name"> =
      typeof roomIdentifier === "string"
        ? { name: roomIdentifier, id: nanoid() }
        : roomIdentifier;

    const clientSession = session.readSession(clientId)!;

    // At this point roomId should be assured to be unique
    // if roomId is invalid here maybe someone is tampering the API, reject
    let room = roomService.getRoom(roomId.id);
    console.group("[join_game]");
    console.log("clientId", clientSession);
    console.log("socket.id", socket.id);
    console.groupEnd();
    if (!room) {
      // Create new room
      room = createNewRoom(
        {
          ...roomId,
        },
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

      // store creation
      roomService.saveRoom(room);

      clientSession.gameId = roomId.id;
      session.updateSession(clientId, clientSession);

      // Game started - send open games
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else if (Object.keys(room.players).length < 2) {
      // Other player joins the battle
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

      // notify opponent that waiting is over
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

      // store changes
      roomService.saveRoom(room);

      io.to(otherSession.socketId).emit(
        "opponent_connected",
        anotherPlayer.name,
      );

      // send open_games update, room is no longer open
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
    } else {
      // no more space in the room
      socket.emit("error", "Room full");

      // Someone wanted to join - send open games
      io.emit("open_games", roomService.getOpenGames());
      emitStats(io);
      return;
    }

    socket.join(roomId.id);
    socket.emit("welcome", clientId);

    // per player emit
    Object.keys(room.players).forEach((playerId) => {
      const payload = toGameState(playerId, room);
      const playerSession = session.readSession(playerId);
      if (playerSession) {
        io.to(playerSession.socketId).emit("game_updated", payload);
      }
    });
  });

  socket.on("leave_game", () => {
    const roomService = RoomService.getInstance();
    const clientSession = session.readSession(clientId);
    if (!clientSession || !clientSession.gameId) {
      // invalid session or state
      socket.emit(
        "error",
        "Invalid session or game state. Can't leave a game, you're not joined.",
      );
      return;
    }

    const room = roomService.getRoom(clientSession.gameId);

    console.log("[leave_game]", "room", room);
    if (room) {
      if (room.phase === "waiting") {
        // 1 player, game is abandoned
        socket.emit("game_updated", null);
        // remove room entry
        roomService.deleteRoom(room.id);
        warRoomNames.releaseRoom(room.name);

        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);
      } else if (room.phase === "placement") {
        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);

        setWaiting(io, socket);
        socket.emit("game_updated", null);
      } else if (room.phase === "playing") {
        const other = getOtherPlayer(clientId, room.players)!;
        // one player forfaits
        room.phase = "finished";
        room.result = {
          [clientId]: "lost",
          [other.id]: "win",
        };
        room.game_finished = new Date().toISOString();
        // store room changes
        roomService.saveRoom(room);

        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);

        // per player emit
        Object.keys(room.players).forEach((playerId) => {
          const playerSession = session.readSession(playerId);
          if (playerSession) {
            io.to(playerSession.socketId).emit(
              "game_updated",
              toGameState(playerId, room),
            );
          }
        });
      } else {
        // make leaving user inactive
        if (room.players[clientId]) {
          room.players[clientId]!.active = false;
          // store room changes
          roomService.saveRoom(room);
        }

        clientSession.gameId = undefined;
        session.updateSession(clientId, clientSession);

        // per player emit
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
    } else {
      clientSession.gameId = undefined;
      session.updateSession(clientId, clientSession);

      socket.emit("error", "No game to leave");
    }
    io.emit("open_games", roomService.getOpenGames());
    emitStats(io);
  });
};
