import { createGameServer } from "./server.js";
import { getReconnectTimeoutMs } from "./utils/reconnectGrace.js";

const isProduction = process.env.NODE_ENV === "production";

const REQUIRED = ['NODE_ENV', 'SESSION_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3101);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid port number");
}

const { httpServer, io, getVersion } = createGameServer({
  instrumentAdminUi: !isProduction,
  logger: !isProduction ? { warn: console.warn } : undefined,
  allowedOrigins: isProduction ? [process.env.ALLOWED_ORIGIN ?? ""] : undefined,
});

// io.listen(PORT);
httpServer.listen(PORT, "0.0.0.0", async () => {
  console.log(
    "Battleship Game Server on",
    "0.0.0.0:",
    PORT,
    "reconnect timeout:",
    getReconnectTimeoutMs(),
    "version:",
    await getVersion(),
  );
  httpServer.on("request", (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ status: "ok", sockets: io.engine.clientsCount }),
      );
    }
    res.writeHead(404).end();
  });
});
