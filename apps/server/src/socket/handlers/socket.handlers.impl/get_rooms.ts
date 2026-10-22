import { IClientToServerEvents } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";
import ActiveGameRegistrySingleton from "../../../services/active-game-registry";

type THandler = IClientToServerEvents["get_rooms"];

export const getRoomsHandler: THandler = (callback) => {
  const roomService = RoomServiceSingleton.getInstance();
  const activeGameRegistry = ActiveGameRegistrySingleton.getInstance();

  console.log(
    "TODO: getRoomsHandler",
    `callback?.(${activeGameRegistry.listRooms()})`,
  );

  callback?.(roomService.listRooms());
};
