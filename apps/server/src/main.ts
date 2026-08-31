import { Server } from "socket.io";
import {
  GameState,
  ClientToServerEvents,
  ServerToClientEvents,
  CellStatus,
} from "@repo/types/src";
import { findRoom } from "./utils/findRoom";

const io = new Server<ClientToServerEvents, ServerToClientEvents>({
  cors: { origin: "*" },
});
const rooms = new Map<string, GameState>();

io.on("connection", (socket) => {
  // 1. Dołączanie do gry
  socket.on("join_game", (roomId) => {
    let room = rooms.get(roomId);

    if (!room) {
      // Tworzymy nowy pokój, jeśli nie istnieje
      room = {
        id: roomId,
        phase: "waiting",
        turn: socket.id,
        boards: { [socket.id]: createEmptyBoard() },
      };
      rooms.set(roomId, room);
    } else {
      // Dołączanie drugiego gracza
      room.boards[socket.id] = createEmptyBoard();
      room.phase = "placement";
    }

    socket.join(roomId);
    io.to(roomId).emit("game_updated", room);
  });

  // 2. Atakowanie z wykorzystaniem findRoom
  socket.on("attack_coordinate", (coord) => {
    const room = findRoom(rooms, socket.id);
    if (!room || room.turn !== socket.id || room.phase !== "playing") {
      socket.emit("error", "Not your turn or game not active");
      return;
    }

    // Race condition prevention: Atomic check
    const opponentId = Object.keys(room.boards).find((id) => id !== socket.id);
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
    if (typeof cell === "number") {
      console.error(
        "Failed to retrieve board cell",
        `Error code: ${cell}`,
        coord,
        targetBoard,
      );
      return;
    }

    // Logic: Update board status
    const result = setCell(
      targetBoard,
      coord.x,
      coord.y,
      cell === "ship" ? "hit" : "miss",
    );

    if (result < 0) {
      console.error("Failed to update board cell", coord, targetBoard);
      return;
    }

    room.turn = opponentId; // Pass turn

    io.to(room.id).emit("game_updated", room);
  });
});

function createEmptyBoard() {
  return Array(10)
    .fill(null)
    .map(() => Array(10).fill("empty"));
}

type TInvalidXCoordinate = -1;
type TInvalidYCoordinate = -2;
type TUnknownError = -3;
type TGetCellFailure =
  TInvalidXCoordinate | TInvalidYCoordinate | TUnknownError;

function getCell(
  board: CellStatus[][],
  x: number,
  y: number,
): CellStatus | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (!row) {
    return -3;
  }
  const cell = row.at(x);
  if (!cell) {
    return -3;
  }
  return cell;
}

function setCell(
  board: CellStatus[][],
  x: number,
  y: number,
  value: CellStatus,
): 0 | TGetCellFailure {
  if (x < 0 || x > 9) return -1;
  if (y < 0 || y > 9) return -2;

  const row = board.at(y);
  if (!row) {
    return -3;
  }
  const cell = row.at(x);
  if (!cell) {
    return -3;
  }

  // update cell
  row[x] = value;

  return 0;
}
