import { createGameServer } from "./server.js";
import { getReconnectTimeoutMs } from "./utils/reconnectGrace.js";

const isProduction = process.env.NODE_ENV === "production";

const PORT = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid port number");
}

const { httpServer } = createGameServer({
  instrumentAdminUi: !isProduction,
  logger: !isProduction ? { warn: console.warn } : undefined,
  allowedOrigins: isProduction ? [process.env.ALLOWED_ORIGIN ?? ""] : undefined,
});

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
