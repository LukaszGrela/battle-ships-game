import type { Server } from "socket.io";
import { IClientToServerEvents, IServerToClientEvents } from "@repo/types";
import { RESTART_RECONNECT_GRACE_MS, getStateDir } from "../../config/state";
import { beginRestartGrace } from "../../utils/reconnectGrace";
import { FileStateStore } from "./FileStateStore";
import { collectStateSnapshot } from "./snapshot";
import { restoreStateSnapshot } from "./restore";
import type { IRestoreReport, IStateSaveResult } from "./types";

type TGameServer = Server<IClientToServerEvents, IServerToClientEvents>;

export interface IStateServiceOptions {
  dir?: string;
  fileName?: string;
}

/**
 * Snapshot coordinator: collects the live state, persists it atomically and
 * restores it on the next boot.
 *
 * `save()` is serialized internally — two overlapping saves would race on the
 * temporary file — and never rejects the previous chain, so a failed save does
 * not block the next one (the interval must keep running).
 */
export class StateService {
  readonly #store: FileStateStore;
  #chain: Promise<unknown> = Promise.resolve();
  #lastSavedAt?: string;

  constructor(options: IStateServiceOptions = {}) {
    this.#store = new FileStateStore({
      dir: options.dir ?? getStateDir(),
      fileName: options.fileName,
    });
  }

  get filePath(): string {
    return this.#store.filePath;
  }

  get lastSavedAt(): string | undefined {
    return this.#lastSavedAt;
  }

  save(): Promise<IStateSaveResult> {
    const run = this.#chain.then(async () => {
      const result = await this.#store.save(collectStateSnapshot());
      this.#lastSavedAt = result.savedAt;
      return result;
    });

    this.#chain = run.catch(() => undefined);

    return run;
  }

  async restore(io: TGameServer): Promise<IRestoreReport> {
    // A crash during a save leaves only the temporary file behind; the real
    // snapshot (or its absence) is still authoritative.
    await this.#store.cleanupTemporaryFile();

    const loaded = await this.#store.load();

    if (loaded.status === "missing") {
      return {
        restored: false,
        rooms: [],
        closedRooms: [],
        sessions: 0,
        gameStats: 0,
        reason: "no-snapshot",
      };
    }

    if (loaded.status === "corrupt") {
      console.warn("[state] snapshot rejected:", loaded.reason);
      return {
        restored: false,
        rooms: [],
        closedRooms: [],
        sessions: 0,
        gameStats: 0,
        reason: loaded.quarantinedPath
          ? `${loaded.reason} (moved to ${loaded.quarantinedPath})`
          : loaded.reason,
      };
    }

    const report = restoreStateSnapshot(io, loaded.state, loaded.savedAt);

    // Everyone was disconnected by the restart itself, so give them a window
    // to come back before the forfeit sweeper touches their battle.
    beginRestartGrace(RESTART_RECONNECT_GRACE_MS);

    this.#lastSavedAt = loaded.savedAt;

    return report;
  }

  /** Test / admin helper: forget the snapshot on disk. */
  async clear(): Promise<void> {
    await this.#store.clear();
  }
}
