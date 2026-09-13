import { EGamePhase, TRoomIdentity, TRoomState } from "@repo/types";
import { getOtherPlayer } from "../utils/getOtherPlayer";

export type TRoomsMap = Map<string, TRoomState>;

console.log("[room.service]");

interface IRoomService {
  /**
   * The room data or `undefined`
   * @param id Room id
   * @returns clone of the room object
   */
  getRoom: (id: string) => TRoomState | undefined;
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
   * Searches room where given player id is in it
   * @param playerId The player identifier
   * @returns clone of the room object
   */
  findRoomBySocketId: (playerId: string) => TRoomState | undefined;

  getOpenGames: () => TRoomIdentity[];

  listRooms: () => TRoomIdentity[];

  setWaiting: (playerId: string) => void;
}

class RoomService implements IRoomService {
  getRoom(id: string): TRoomState | undefined {
    this.log("getRoom", id);
    const room = this.rooms.get(id);

    if (room) return structuredClone(room);

    return undefined;
  }

  saveRoom(room: TRoomState): void {
    this.log("saveRoom", room.id, room.phase);
    this.rooms.set(room.id, room);
  }

  deleteRoom(id: string): boolean {
    this.log("deleteRoom", id);

    return this.rooms.delete(id);
  }

  findRoomBySocketId(playerId: string): TRoomState | undefined {
    this.log("findRoomBySocketId");
    const room = Array.from(this.rooms.values()).find(
      (r) => r.players[playerId],
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
      ({ id, name, game_finished, game_started, game_created, phase }) => ({
        id,
        name,
        game_finished,
        game_started,
        game_created,
        phase,
      }),
    );
  }

  setWaiting(playerId: string): void {
    this.log("setWaiting", playerId);
    const room = this.findRoomBySocketId(playerId);
    if (!room) return;

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

  private rooms: TRoomsMap = new Map<string, TRoomState>();

  private log(...msg: string[]) {
    console.log("[RoomService]", ...msg);
  }
}

/**
 * Singleton wrapper around `RoomService` class
 */
class RoomServiceSingleton {
  // static
  static #instance?: IRoomService;
  public static getInstance(): IRoomService {
    // console.log(TAG, 'RoomService.getInstance');
    if (!RoomServiceSingleton.#instance) {
      console.log("[room.service]new RoomService()");
      RoomServiceSingleton.#instance = new RoomService();
    }

    return RoomServiceSingleton.#instance;
  }
}

export default RoomServiceSingleton;
