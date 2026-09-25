import { ActiveUsersService, IActiveUsersService } from "./users.service.impl";

/**
 * Singleton wrapper around `ActiveUsersService` class
 */
class ActiveUsersServiceSingleton {
  // static
  static #instance?: IActiveUsersService;
  public static getInstance(): IActiveUsersService {
    // console.log(TAG, 'ActiveUsersService.getInstance');
    if (!ActiveUsersServiceSingleton.#instance) {
      console.log("[room.service]new ActiveUsersService()");
      ActiveUsersServiceSingleton.#instance = new ActiveUsersService();
    }

    return ActiveUsersServiceSingleton.#instance;
  }
}

export default ActiveUsersServiceSingleton;
