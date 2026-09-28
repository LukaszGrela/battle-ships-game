import { Server } from "socket.io";
import { createServer } from "node:http";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { factoryConnectHandler } from "./socket";
import {
  expireDisconnectedPlayers,
  getReconnectTimeoutMs,
} from "./utils/reconnectGrace";

const PORT = 3001;
const httpServer = createServer();

const io = new Server<IClientToServerEvents, IServerToClientEvents>(
  httpServer,
  {
    cors: {
      // only while in DEV!
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false,
    },
  },
);

io.on("connection", factoryConnectHandler(io));

setInterval(() => {
  expireDisconnectedPlayers(io);
}, 5_000);

// io.listen(PORT);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Battleship Game Server on",
    "0.0.0.0:",
    PORT,
    "reconnect timeout:",
    getReconnectTimeoutMs(),
  );
});
