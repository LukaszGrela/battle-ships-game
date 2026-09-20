interface IActiveUsersService {
  setUser: (userId: string) => void;
  removeUser: (userId: string) => boolean;
  countUsers: () => number;
}

class ActiveUsersService implements IActiveUsersService {
  public setUser(userId: string) {
    this.users.add(userId);
  }

  public countUsers() {
    return this.users.size;
  }
  public removeUser(userId: string) {
    return this.users.delete(userId);
  }

  private users = new Set<string>();

  private log(...msg: string[]) {
    console.log("[ActiveUsersService]", ...msg);
  }
}

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
