import { createGameServer } from "./server.js";
import { isDev } from "./utils/isDev.js";
import { getReconnectTimeoutMs } from "./utils/reconnectGrace.js";
import { SHUTDOWN_SAVE_TIMEOUT_MS } from "./config/state.js";

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

const { httpServer, ready, stateFilePath, saveState, getVersion } =
  createGameServer({
    instrumentAdminUi: isDev(),
    logger: isDev() ? { warn: console.warn } : undefined,
    allowedOrigins: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : undefined,
  });

void ready.then((report) => {
  if (report.restored) {
    console.log(
      `State restored from ${stateFilePath} (saved ${report.savedAt}):`,
      `${report.rooms.length} room(s),`,
      `${report.sessions} session(s),`,
      `${report.gameStats} result(s)`,
    );
  } else {
    console.log(`No state restored (${report.reason})`);
  }
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
  if (stateFilePath) {
    console.log("State persistence:", stateFilePath);
  }
  if (!isDev()) {
    console.log("process.env.ALLOWED_ORIGINS:", process.env.ALLOWED_ORIGINS);
    console.log("Allowed origins:", ALLOWED_ORIGINS);
  }
});

/**
 * Planned restart: write the snapshot first, then close.
 *
 * `systemctl restart`, `docker stop` and Ctrl-C all arrive here, so a restart
 * triggered by a deploy loses nothing as long as the process gets these few
 * seconds. A hard kill (`SIGKILL`, power loss) is handled by the periodic
 * autosave instead.
 */
let shuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[shutdown] ${signal} received, saving state`);

  // Never let a stuck disk or socket keep the container from exiting.
  const forced = setTimeout(() => {
    console.error("[shutdown] timed out, exiting without a clean close");
    process.exit(1);
  }, SHUTDOWN_SAVE_TIMEOUT_MS + 5_000);
  forced.unref();

  try {
    console.log("[shutdown] state saved:", await saveState());
  } catch (error) {
    console.error("[shutdown] state save failed:", error);
  }

  try {
    await httpServer.close();
  } catch (error) {
    console.error("[shutdown] server close failed:", error);
  }

  clearTimeout(forced);
  process.exit(0);
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
