import {
  RESTART_RECONNECT_NOTICE_MS,
  SHUTDOWN_NOTICE_FLUSH_MS,
  SHUTDOWN_RECONNECT_NOTICE_MS,
} from "../../config/state.js";
import type { IServerRestartNotice } from "@repo/types";

/**
 * The subset of `io` the shutdown hook needs. Keeping it narrow makes the
 * notice testable without a running Socket.IO server.
 */
export interface IServerRestartEmitter {
  emit: (event: "server_restarting", notice: IServerRestartNotice) => unknown;
}

/**
 * A `SIGTERM` normally comes from a supervisor (systemd, a deploy script), so
 * the process is expected back. `SIGINT` is somebody pressing Ctrl-C: honest
 * wording matters more than a promise we cannot keep.
 */
export const buildRestartNotice = (
  signal: NodeJS.Signals,
): IServerRestartNotice =>
  signal === "SIGINT"
    ? { reason: "shutdown", graceMs: SHUTDOWN_RECONNECT_NOTICE_MS }
    : { reason: "restart", graceMs: RESTART_RECONNECT_NOTICE_MS };

export const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    // A pending timer must not keep a dying process alive.
    (timer as { unref?: () => void }).unref?.();
  });

/**
 * Tells every connected player that the server is going down, then gives the
 * frame a moment to reach them.
 *
 * This has to run **before** the snapshot is written: the event is only useful
 * while the transport is still open, and a slow disk would otherwise close the
 * sockets first.
 */
export const announceServerRestart = async (
  io: IServerRestartEmitter,
  notice: IServerRestartNotice,
): Promise<void> => {
  io.emit("server_restarting", notice);
  await wait(SHUTDOWN_NOTICE_FLUSH_MS);
};
