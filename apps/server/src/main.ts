import { createGameServer } from "./server.js";
import { isDev } from "./utils/isDev.js";
import { getReconnectTimeoutMs } from "./utils/reconnectGrace.js";

const REQUIRED = ["NODE_ENV", "SESSION_SECRET"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3101);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be a valid port number");
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)
  .map((entry) => {
    if (!entry.startsWith("RE:")) return entry;

    const pattern = entry.slice(3);
    try {
      return new RegExp(pattern);
    } catch (err) {
      throw new Error(
        `Invalid regex in ALLOWED_ORIGINS: ${pattern} (${(err as Error).message})`,
      );
    }
  });

const { httpServer, io, getVersion } = createGameServer({
  instrumentAdminUi: isDev(),
  logger: isDev() ? { warn: console.warn } : undefined,
  allowedOrigins: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : undefined,
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
  if (!isDev()) {
    console.log("process.env.ALLOWED_ORIGINS:", process.env.ALLOWED_ORIGINS);
    console.log("Allowed origins:", ALLOWED_ORIGINS);
  }

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
