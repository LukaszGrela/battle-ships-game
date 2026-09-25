import { stableHash } from "@repo/game-logic";
import { IClientSession } from "@repo/types";
import { getShortPirateName } from "../utils/getPirateyName";

export interface IClientSessionService {
  createSession: (
    id: string,
    socketId: string,
    gameId?: string,
  ) => IClientSession;
  readSession: (id: string) => IClientSession | null;
  updateSession: (id: string, session: IClientSession) => boolean;
  deleteSession: (id: string) => boolean;
}

export class ClientSessionService implements IClientSessionService {
  private sessions = new Map<string, IClientSession>();

  createSession(id: string, socketId: string, gameId?: string): IClientSession {
    const existingSession = this.sessions.get(id);
    if (existingSession) {
      return existingSession;
    }
    const seed = stableHash(id);
    const session: IClientSession = {
      id,
      socketId,
      gameId,

      name: getShortPirateName(seed),
      seed,
    };

    this.sessions.set(id, session);
    return session;
  }

  readSession(id: string): IClientSession | null {
    return this.sessions.get(id) ?? null;
  }

  updateSession(id: string, session: IClientSession): boolean {
    if (!this.sessions.has(id)) {
      return false;
    }

    this.sessions.set(id, session);
    return true;
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }
}
