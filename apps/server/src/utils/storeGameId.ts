import ClientSessionServiceSingleton from "../services/client-session.service";

export function storeGameId(
  playerId: string,
  gameId: string | undefined,
): boolean {
  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();
  const clientSession = sessions.readSession(playerId);
  if (!clientSession) return false;

  clientSession.gameId = gameId;
  return sessions.updateSession(playerId, clientSession);
}
