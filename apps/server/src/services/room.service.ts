import { IRoomService, RoomService } from "./room.service.impl";

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
