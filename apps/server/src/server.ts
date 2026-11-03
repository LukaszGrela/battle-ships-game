import { instrument } from "@socket.io/admin-ui";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { factoryConnectHandler } from "./socket";
import { expireDisconnectedPlayers } from "./utils/reconnectGrace";

export interface IGameServerOptions {
  instrumentAdminUi?: boolean;
  reconnectSweepIntervalMs?: number;
}

export function createGameServer({
  instrumentAdminUi = true,
  reconnectSweepIntervalMs = 5_000,
}: IGameServerOptions = {}) {
  const httpServer = createServer();
  const io = new Server<IClientToServerEvents, IServerToClientEvents>(
    httpServer,
    {
      cors: {
        // only while in DEV!
        origin: ["https://admin.socket.io"],
        methods: ["GET", "POST"],
        credentials: true,
      },
    },
  );

  io.on("connection", factoryConnectHandler(io));

  const reconnectSweep = setInterval(() => {
    expireDisconnectedPlayers(io);
  }, reconnectSweepIntervalMs);
  reconnectSweep.unref();

  if (instrumentAdminUi) {
    instrument(io, {
      auth: false,
      mode: "development",
    });
  }

  return {
    httpServer,
    io,
    close: async () => {
      clearInterval(reconnectSweep);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
