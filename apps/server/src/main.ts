import { Server } from "socket.io";
import {
  IClientToServerEvents,
  IServerToClientEvents,
} from "@repo/types";
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
