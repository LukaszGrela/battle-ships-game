import { IClientToServerEvents } from "@repo/types";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";

type THandler = IClientToServerEvents["get_rooms"];

export const getRoomsHandler: THandler = (callback) => {
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  callback?.(activeGameRegistry.listRooms());
};
