import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { STATE_FILE_NAME, STATE_SNAPSHOT_VERSION } from "../../config/state";
import type {
  IStateEnvelope,
  IStateSaveResult,
  IStateSnapshot,
  TStateLoadResult,
} from "./types";

export interface IFileStateStoreOptions {
  dir: string;
  fileName?: string;
}

const checksumOf = (payload: string): string =>
  createHash("sha256").update(payload).digest("hex");

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Snapshot storage on the local filesystem.
 *
 * Writes are atomic: the payload goes to `<file>.tmp` first and is then renamed
 * over the snapshot, so a crash (or a second restart) can never leave a
 * half-written file where a valid one used to be. A file that fails validation
 * is moved aside instead of being deleted — a corrupt snapshot is the only
 * thing left after a bad crash, so it is worth keeping for inspection.
 */
export class FileStateStore {
  readonly #dir: string;
  readonly #filePath: string;
  readonly #tmpPath: string;

  constructor({ dir, fileName = STATE_FILE_NAME }: IFileStateStoreOptions) {
    this.#dir = path.resolve(dir);
    this.#filePath = path.join(this.#dir, fileName);
    this.#tmpPath = `${this.#filePath}.tmp`;
  }

  get dir(): string {
    return this.#dir;
  }

  get filePath(): string {
    return this.#filePath;
  }

  async save(state: IStateSnapshot): Promise<IStateSaveResult> {
    const payload = JSON.stringify(state);
    const envelope: IStateEnvelope = {
      version: STATE_SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      checksum: checksumOf(payload),
      state,
    };
    const serialized = JSON.stringify(envelope);

    await mkdir(this.#dir, { recursive: true });
    await writeFile(this.#tmpPath, serialized, "utf8");
    await rename(this.#tmpPath, this.#filePath);

    return {
      savedAt: envelope.savedAt,
      bytes: Buffer.byteLength(serialized),
      rooms: state.rooms.length,
      sessions: state.sessions.length,
      gameStats: state.gameStats.length,
    };
  }

  async load(): Promise<TStateLoadResult> {
    let raw: string;
    try {
      raw = await readFile(this.#filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { status: "missing" };
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.#quarantine("invalid JSON");
    }

    if (!isPlainObject(parsed)) {
      return this.#quarantine("envelope is not an object");
    }

    const { version, savedAt, checksum, state } = parsed as Partial<
      Record<keyof IStateEnvelope, unknown>
    >;

    if (typeof version !== "number") {
      return this.#quarantine("missing version");
    }
    if (version !== STATE_SNAPSHOT_VERSION) {
      return this.#quarantine(`unsupported snapshot version ${version}`);
    }
    if (!isPlainObject(state)) {
      return this.#quarantine("missing state");
    }
    if (typeof checksum !== "string") {
      return this.#quarantine("missing checksum");
    }

    const actualChecksum = checksumOf(JSON.stringify(state));
    if (actualChecksum !== checksum) {
      return this.#quarantine("checksum mismatch");
    }

    if (
      !Array.isArray(state.rooms) ||
      !Array.isArray(state.sessions) ||
      !Array.isArray(state.roomNames) ||
      !Array.isArray(state.gameStats)
    ) {
      return this.#quarantine("malformed state");
    }

    return {
      status: "ok",
      savedAt: typeof savedAt === "string" ? savedAt : new Date().toISOString(),
      state: state as unknown as IStateSnapshot,
    };
  }

  async clear(): Promise<void> {
    await rm(this.#filePath, { force: true });
    await rm(this.#tmpPath, { force: true });
  }

  /** Removes a leftover `.tmp` file from a write interrupted by a crash. */
  async cleanupTemporaryFile(): Promise<void> {
    await rm(this.#tmpPath, { force: true });
  }

  async #quarantine(reason: string): Promise<TStateLoadResult> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantinedPath = `${this.#filePath}.corrupt-${stamp}`;

    try {
      await rename(this.#filePath, quarantinedPath);
    } catch {
      // The file vanished or is unreadable; nothing to keep.
      return { status: "corrupt", reason };
    }

    return { status: "corrupt", reason, quarantinedPath };
  }
}
