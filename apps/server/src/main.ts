import { Server } from "socket.io";
import {
  IClientToServerEvents,
  IServerToClientEvents,
  ECellStatus,
  EGamePhase,
  TShip,
  IHistoryEntry,
} from "@repo/types";
import { getCell, placeShip, resolveAttack, setCell } from "@repo/game-logic";
import { warRoomNames } from "./utils/WarRoomNameService";
import { RoomService } from "./services/room.service";
import { getOtherPlayer } from "./utils/getOtherPlayer";
import { singleUser } from "./utils/singleUser";
import { toGameState } from "./utils/toGameState";
import { registerSocketHandlers } from "./socket";

const PORT = 3001;

const io = new Server<IClientToServerEvents, IServerToClientEvents>({
  cors: { origin: "*" },
});

console.log("Battleship Game Server, port", PORT);

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

io.listen(PORT);
