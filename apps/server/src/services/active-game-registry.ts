import {
  IActiveGameRegistry,
  ActiveGameRegistry,
} from "./active-game-registry.impl";

/**
 * Singleton wrapper around `ActiveGameRegistry` class
 */
class ActiveGameRegistrySingleton {
  // static
  static #instance?: IActiveGameRegistry;
  public static getInstance(): IActiveGameRegistry {
    // console.log(TAG, 'ActiveGameRegistry.getInstance');
    if (!ActiveGameRegistrySingleton.#instance) {
      ActiveGameRegistrySingleton.#instance = new ActiveGameRegistry();
    }

    return ActiveGameRegistrySingleton.#instance;
  }
}

export default ActiveGameRegistrySingleton;
