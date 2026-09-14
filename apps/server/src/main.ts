import { Server } from "socket.io";
import { createServer } from "node:http";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { registerSocketHandlers } from "./socket";

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

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

// io.listen(PORT);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Battleship Game Server on", "0.0.0.0:", PORT);
});
