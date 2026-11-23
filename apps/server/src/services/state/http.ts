import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getStateSaveToken,
  isStatePersistenceEnabled,
} from "../../config/state";
import type { IStateSaveResult } from "./types";
import type { TServerRestartReason } from "@repo/types";

/** Undocumented admin route: only reachable with the shared token. */
export const STATE_SAVE_PATH = "/admin/state/save";
/**
 * Same guard, but it also broadcasts the `server_restarting` notice before the
 * snapshot is written. `systemd` calls this from `ExecStop`, so a planned
 * restart still warns the players when the signal itself never lands (a broken
 * cgroup / an immediate SIGKILL).
 */
export const STATE_RESTART_PATH = "/admin/state/restart";
export const STATE_TOKEN_HEADER = "x-state-token";

export interface IStateHttpContext {
  enabled: boolean;
  saveToken?: string;
  getVersion: () => Promise<string>;
  getSocketCount: () => number;
  save: () => Promise<IStateSaveResult>;
  /** Emits `server_restarting` and flushes it; used by the restart route. */
  announceRestart?: (reason: TServerRestartReason) => Promise<void>;
  now?: () => number;
}

const TOKEN_HASH_ALGORITHM = "sha256";

const digest = (value: string): Buffer =>
  createHash(TOKEN_HASH_ALGORITHM).update(value).digest();

/**
 * Constant-time comparison on fixed-length digests: `timingSafeEqual` throws on
 * different lengths, and comparing raw tokens would leak the length anyway.
 */
const tokenMatches = (provided: string, expected: string): boolean => {
  const a = digest(provided);
  const b = digest(expected);
  return timingSafeEqual(a, b);
};

const readToken = (req: IncomingMessage): string | undefined => {
  const header = req.headers[STATE_TOKEN_HEADER];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw?.trim()) return raw.trim();

  const authorization = req.headers.authorization;
  const prefix = "bearer ";
  if (authorization?.toLowerCase().startsWith(prefix)) {
    return authorization.slice(prefix.length).trim() || undefined;
  }

  return undefined;
};

/**
 * Deliberately indistinguishable 404 for "wrong path", "wrong method", "no
 * token" and "invalid token". The endpoint is not discoverable: probing it
 * looks exactly like probing any other unknown URL, and an unconfigured
 * deployment answers the same way as a misconfigured one.
 */
const notFound = (res: ServerResponse): void => {
  res.writeHead(404).end();
};

/**
 * Which wording `ExecStop` asks for: a planned restart (default) or a stop that
 * leaves the port silent for a while.
 */
const readReason = (url: string | undefined): TServerRestartReason => {
  const query = (url ?? "").split("?")[1] ?? "";
  const value = new URLSearchParams(query).get("reason")?.trim().toLowerCase();
  return value === "shutdown" ? "shutdown" : "restart";
};

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
};

export const createStateHttpHandler = (context: IStateHttpContext) => {
  const enabled = context.enabled && Boolean(context.saveToken);
  const saveToken = context.saveToken;
  const now = context.now ?? Date.now;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = (req.url ?? "").split("?")[0];

    if (pathname === "/health") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        notFound(res);
        return;
      }

      sendJson(res, 200, {
        status: "ok",
        uptime: Math.round(process.uptime()),
        timestamp: now(),
        clientsCount: context.getSocketCount(),
        version: await context.getVersion(),
      });
      return;
    }

    const isRestartRoute = pathname === STATE_RESTART_PATH;

    if (!isRestartRoute && pathname !== STATE_SAVE_PATH) {
      notFound(res);
      return;
    }

    if (!enabled || !saveToken) {
      notFound(res);
      return;
    }

    if (isRestartRoute && !context.announceRestart) {
      notFound(res);
      return;
    }

    const provided = readToken(req);
    if (!provided || !tokenMatches(provided, saveToken)) {
      notFound(res);
      return;
    }

    if (req.method !== "POST") {
      notFound(res);
      return;
    }

    // Drain a request body we do not use, so keep-alive connections are not
    // left with unread bytes.
    req.resume();

    const reason = readReason(req.url);

    try {
      if (isRestartRoute) {
        const announceRestart = context.announceRestart;
        if (announceRestart) {
          // Notice first: it is only useful while the sockets are still open.
          await announceRestart(reason);
        }
      }

      const result = await context.save();
      sendJson(res, 200, {
        ok: true,
        ...(isRestartRoute ? { announced: reason } : {}),
        ...result,
      });
    } catch (error) {
      console.error("[state] admin save failed:", error);
      sendJson(res, 500, { ok: false, error: "save-failed" });
    }
  };
};

/** The handler for a server that runs without persistence. */
export const createDisabledStateHttpHandler = () =>
  createStateHttpHandler({
    enabled: isStatePersistenceEnabled(),
    saveToken: getStateSaveToken(),
    getVersion: async () => "unknown",
    getSocketCount: () => 0,
    save: async () => {
      throw new Error("state persistence is disabled");
    },
  });
