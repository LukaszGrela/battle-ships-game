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
  listSessions: () => IClientSession[];

  clearSessionGame: (id: string) => boolean;
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

    return this.sessions.get(id)!;
  }

  readSession(id: string): IClientSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    return structuredClone(session);
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

  listSessions(): IClientSession[] {
    return Array.from(this.sessions.values()).map((session) =>
      structuredClone(session),
    );
  }

  clearSessionGame(id: string): boolean {
    if (!this.sessions.has(id)) {
      return false;
    }

    const session = this.sessions.get(id)!;
    session.gameId = undefined;
    session.disconnectedAt = undefined;

    return true;
  }
}
