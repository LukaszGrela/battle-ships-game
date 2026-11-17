import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { Server, Socket } from "socket.io";
import { factoryCreateGameWithBotHandler } from "./socket.handlers.impl/create_game_with_bot";
import { factoryBotOpponentHandler } from "./socket.handlers.impl/bot_opponent";

export const registerBotGameHandlers = (
  io: Server<IClientToServerEvents, IServerToClientEvents>,
  socket: Socket<IClientToServerEvents, IServerToClientEvents>,
) => {
  socket.on("bot_opponent", factoryBotOpponentHandler(io, socket));
  socket.on(
    "create_game_with_bot",
    factoryCreateGameWithBotHandler(io, socket),
  );
};
