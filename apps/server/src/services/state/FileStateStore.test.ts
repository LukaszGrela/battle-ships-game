import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STATE_FILE_NAME, STATE_SNAPSHOT_VERSION } from "../../config/state";
import { FileStateStore } from "./FileStateStore";
import type { IStateSnapshot } from "./types";

const createSnapshot = (): IStateSnapshot => ({
  rooms: [
    { id: "room-1", name: "Czarna-Perla", phase: "playing", data: '{"a":1}' },
  ],
  sessions: [
    {
      id: "owner",
      socketId: "sock-1",
      gameId: "room-1",
      name: "Owner",
      seed: 7,
    },
  ],
  roomNames: ["Czarna-Perla"],
  gameStats: [],
});

describe("services/state", () => {
  describe("FileStateStore", () => {
    let dir: string;
    let store: FileStateStore;

    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), "battle-ships-state-"));
      store = new FileStateStore({ dir });
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it("reports a missing snapshot without throwing", async () => {
      await expect(store.load()).resolves.toEqual({ status: "missing" });
    });

    it("round-trips the snapshot payload", async () => {
      const snapshot = createSnapshot();
      const result = await store.save(snapshot);

      expect(result.rooms).toBe(1);
      expect(result.sessions).toBe(1);
      expect(result.bytes).toBeGreaterThan(0);

      const loaded = await store.load();
      expect(loaded.status).toBe("ok");
      if (loaded.status !== "ok") return;

      expect(loaded.state).toEqual(snapshot);
      expect(loaded.savedAt).toBe(result.savedAt);
    });

    it("writes atomically and keeps the snapshot versioned", async () => {
      await store.save(createSnapshot());

      const entries = await readdir(dir);
      expect(entries).toEqual([STATE_FILE_NAME]);

      const envelope = JSON.parse(
        await readFile(path.join(dir, STATE_FILE_NAME), "utf8"),
      );
      expect(envelope.version).toBe(STATE_SNAPSHOT_VERSION);
      expect(typeof envelope.checksum).toBe("string");
    });

    it("rejects tampered content and quarantines the file", async () => {
      await store.save(createSnapshot());

      const file = path.join(dir, STATE_FILE_NAME);
      const envelope = JSON.parse(await readFile(file, "utf8"));
      envelope.state.roomNames = ["injected"];
      await writeFile(file, JSON.stringify(envelope));

      const loaded = await store.load();
      expect(loaded.status).toBe("corrupt");
      if (loaded.status !== "corrupt") return;
      expect(loaded.quarantinedPath).toBeTruthy();

      const entries = await readdir(dir);
      expect(entries.some((entry) => entry.includes(".corrupt-"))).toBe(true);
      // The corrupt file is moved aside, so the canonical path is free again.
      expect(entries).not.toContain(STATE_FILE_NAME);

      const reloaded = await store.load();
      expect(reloaded.status).toBe("missing");

      await store.save(createSnapshot());
      expect(await readdir(dir)).toContain(STATE_FILE_NAME);
    });

    it("rejects a newer, unsupported snapshot version", async () => {
      await store.save(createSnapshot());

      const file = path.join(dir, STATE_FILE_NAME);
      const envelope = JSON.parse(await readFile(file, "utf8"));
      envelope.version = STATE_SNAPSHOT_VERSION + 1;
      await writeFile(file, JSON.stringify(envelope));

      const loaded = await store.load();
      expect(loaded.status).toBe("corrupt");
      if (loaded.status !== "corrupt") return;
      expect(loaded.reason).toContain("version");
    });

    it("clears the snapshot and leftovers of an interrupted save", async () => {
      await store.save(createSnapshot());
      await writeFile(`${store.filePath}.tmp`, "partial");

      await store.cleanupTemporaryFile();
      expect(await readdir(dir)).toEqual([STATE_FILE_NAME]);

      await store.clear();
      expect(await readdir(dir)).toEqual([]);
      await expect(store.load()).resolves.toEqual({ status: "missing" });
    });
  });
});
