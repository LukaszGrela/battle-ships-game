// handlers/getWarRoomName.handler.ts
import { IClientToServerEvents } from "@repo/types";
import { warRoomNames } from "../../../services/WarRoomName.service";

type TGetWarRoomNameHandler = IClientToServerEvents["get_war_room_name"];

export const getWarRoomNameHandler: TGetWarRoomNameHandler = (
  proposition,
  callback,
) => {
  if (proposition === null) {
    callback(warRoomNames.getAvailableName());
    return;
  }

  callback(
    warRoomNames.isFreeToClaim(proposition)
      ? proposition
      : warRoomNames.getAvailableName(),
  );
};
