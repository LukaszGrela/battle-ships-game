import { IClientToServerEvents } from "@repo/types";
import { getStats } from "../../../utils/emitStats";

type THandler = IClientToServerEvents["get_stats"];

export const getStatsHandler: THandler = (callback) => {
  callback?.(getStats());
};
