import os from "node:os";
import path from "node:path";

/** Version of the on-disk snapshot envelope. Bump with a migration in `restore.ts`. */
export const STATE_SNAPSHOT_VERSION = 1;

/** File name inside `STATE_DIR`. */
export const STATE_FILE_NAME = "server-state.json";

/**
 * Reconnect window granted to the players right after a restore. A restart
 * disconnects everyone at once, so the regular reconnect timeout would forfeit
 * every running battle before anybody manages to reload the page.
 */
export const RESTART_RECONNECT_GRACE_MS = 90_000;

/** Upper bound for a save during shutdown; we do not want to hang `kill`. */
export const SHUTDOWN_SAVE_TIMEOUT_MS = 10_000;

/**
 * Periodic snapshot interval for crash recovery. Players need at least 3 s
 * between actions, so 15 s of lost progress is at most a handful of moves.
 */
export const AUTOSAVE_INTERVAL_MS = 15_000;

/**
 * Directory holding the snapshot. It lives **outside the repository** on
 * purpose: a deploy (`git pull`, `git clean`, rebuilding `node_modules`) must
 * never be able to delete the saved games. Set `STATE_DIR` in production.
 */
export const getStateDir = (): string => {
  const configured = process.env.STATE_DIR?.trim();
  if (configured) return path.resolve(configured);

  return path.join(os.homedir(), ".battle-ships-game", "state");
};

export const getStateFilePath = (): string =>
  path.join(getStateDir(), STATE_FILE_NAME);

/**
 * Persistence is opt-in so local dev and the test suite never read or write a
 * snapshot by accident. Any of `STATE_ENABLED`, `STATE_DIR` or
 * `STATE_SAVE_TOKEN` turns it on; `STATE_ENABLED=false` forces it off.
 */
export const isStatePersistenceEnabled = (): boolean => {
  const flag = process.env.STATE_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;

  return Boolean(
    process.env.STATE_DIR?.trim() || process.env.STATE_SAVE_TOKEN?.trim(),
  );
};

/**
 * Token guarding the admin save endpoint. Without it the endpoint is not
 * mounted at all, so there is nothing to brute force.
 */
export const getStateSaveToken = (): string | undefined => {
  const token = process.env.STATE_SAVE_TOKEN?.trim();
  return token ? token : undefined;
};
