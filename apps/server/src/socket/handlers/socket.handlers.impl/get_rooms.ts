import { IClientToServerEvents } from "@repo/types";
import RoomServiceSingleton from "../../../services/room.service";

type THandler = IClientToServerEvents["get_rooms"];

export const getRoomsHandler: THandler = (callback) => {
  const roomService = RoomServiceSingleton.getInstance();

  callback?.(roomService.listRooms());
};
