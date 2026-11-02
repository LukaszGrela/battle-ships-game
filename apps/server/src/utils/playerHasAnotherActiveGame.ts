import { EGamePhase } from "@repo/types";
import ActiveGameRegistrySingleton from "../services/active-game-registry";
import ClientSessionServiceSingleton from "../services/client-session.service";

export function playerHasAnotherActiveGame(playerId: string): boolean {
  // required user exists
  const sessions = ClientSessionServiceSingleton.getInstance();
  const clientSession = sessions.readSession(playerId);
  if (!clientSession) return false;
  if (!clientSession.gameId) return false;

  const roomId = clientSession.gameId;
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  function isRoomActive() {
    const room = activeGameRegistry.getRoom(roomId);
    if (!room) return false;

    return room.getPhase() !== EGamePhase.Finished;
  }

  return isRoomActive();
}
