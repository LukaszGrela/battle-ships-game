import { EGamePhase, TRoomIdentity, TRoomState } from "@repo/types";
import { getOtherPlayer } from "../utils/getOtherPlayer";

export type TRoomsMap = Map<string, TRoomState>;

export interface IRoomService {
  /**
   * The room data or `undefined`
   * @param id Room id
   * @returns clone of the room object
   */
  getRoom: (id: string) => TRoomState | undefined;
  hasRoom: (id: string) => boolean;
  isRoomActive: (id: string) => boolean;
  /**
   * Save or update room data
   * @param room Room data
   */
  saveRoom: (room: TRoomState) => void;

  /**
   * Removes the room from the list
   * @param id Room identifier
   * @returns `true` if an element in the Map existed and has been removed, or `false` if the element does not exist.
   */
  deleteRoom: (id: string) => boolean;

  /**
   * Searches room where given player id is in it and phase is not finished
   * @param playerId The player identifier
   * @returns clone of the room object
   */
  findActiveRoomByPlayerId: (playerId: string) => TRoomState | undefined;

  getOpenGames: () => TRoomIdentity[];

  listRooms: () => TRoomIdentity[];

  setWaiting: (playerId: string) => void;

  /**
   * Number of active games (phase placement/playing)
   */
  activeGames: () => number;
  /**
   * Number of completed games (phase finished), including all the battles in the room (rematches)
   */
  playedGames: () => number;
}

/**
 * This is "active game registry"
 */
export class RoomService implements IRoomService {
  getRoom(id: string): TRoomState | undefined {
    this.log("getRoom", id);
    const room = this.rooms.get(id);

    if (room) return structuredClone(room);

    return undefined;
  }
  hasRoom(id: string): boolean {
    return this.rooms.has(id);
  }
  isRoomActive(id: string): boolean {
    if (!this.hasRoom(id)) return false;

    return this.rooms.get(id)?.phase !== EGamePhase.Finished;
  }

  saveRoom(room: TRoomState): void {
    this.log("saveRoom", room.id, room.phase);
    this.rooms.set(room.id, room);
  }

  deleteRoom(id: string): boolean {
    this.log("deleteRoom", id);

    return this.rooms.delete(id);
  }

  findActiveRoomByPlayerId(playerId: string): TRoomState | undefined {
    this.log("findActiveRoomByPlayerId");
    const room = Array.from(this.rooms.values()).find(
      (r) => r.players[playerId] && r.phase !== EGamePhase.Finished,
    );
    if (room) {
      return structuredClone(room);
    }
    return undefined;
  }

  getOpenGames(): TRoomIdentity[] {
    this.log("getOpenGames");
    return this.listRooms().filter((room) => room.phase === EGamePhase.Waiting);
  }

  listRooms(): TRoomIdentity[] {
    this.log("listRooms");
    return Array.from(this.rooms.values()).map(
      ({
        id,
        name,
        game_finished,
        game_started,
        game_created,
        phase,
        result,
      }) => ({
        id,
        name,
        game_finished,
        game_started,
        game_created,
        phase,
        //TODO: add results field
      }),
    );
  }

  setWaiting(playerId: string): void {
    this.log("setWaiting", playerId);
    const room = this.findActiveRoomByPlayerId(playerId);

    if (!room) return;
    if (room.phase === "finished" || room.phase === "playing") return;

    room.phase = EGamePhase.Waiting;
    const other = getOtherPlayer(playerId, room.players)!;
    // if user that left is the "owner" change the turn
    room.turn = other.id;
    other.owner = true;
    //
    delete room.boards[playerId];
    delete room.players[playerId];
    room.ships = {};

    this.saveRoom(room);
  }

  activeGames(): number {
    return Array.from(this.rooms.values()).filter(
      (needle) =>
        needle.phase === EGamePhase.Placement ||
        needle.phase === EGamePhase.Playing,
    ).length;
  }

  playedGames(): number {
    return Array.from(this.rooms.values())
      .filter((needle) => needle.phase !== EGamePhase.Waiting)
      .reduce((acc, room) => {
        // count finished as 1 + battles length
        if (room.phase === EGamePhase.Finished) {
          return acc + 1 + room.battles.length;
        }
        // count placement and playing as 0 + battles length
        return acc + room.battles.length;
      }, 0);
  }

  private rooms: TRoomsMap = new Map<string, TRoomState>();

  private log(...msg: string[]) {
    console.log("[RoomService]", ...msg);
  }
}
