import { GameState } from "@repo/types";

/**
 * Znajduje pokój, w którym znajduje się dany socketId.
 * W architekturze Battleship gracz jest częścią pokoju, jeśli jego ID
 * znajduje się w kluczach obiektu boards.
 */
export function findRoom(
  rooms: Map<string, GameState>,
  socketId: string,
): GameState | undefined {
  for (const room of rooms.values()) {
    if (Object.prototype.hasOwnProperty.call(room.boards, socketId)) {
      return room;
    }
  }
  return undefined;
}
