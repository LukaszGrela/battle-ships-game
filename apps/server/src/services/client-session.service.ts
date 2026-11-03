import {
  ClientSessionService,
  IClientSessionService,
} from "./client-session.service.impl";

/**
 * Singleton wrapper around `ClientSessionService` class
 */
class ClientSessionServiceSingleton {
  // static
  static #instance?: IClientSessionService;
  public static getInstance(): IClientSessionService {
    // console.log(TAG, 'ClientSessionService.getInstance');
    if (!ClientSessionServiceSingleton.#instance) {
      ClientSessionServiceSingleton.#instance = new ClientSessionService();
    }

    return ClientSessionServiceSingleton.#instance;
  }
}

export default ClientSessionServiceSingleton;
