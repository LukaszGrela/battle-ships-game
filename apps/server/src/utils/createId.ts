import { randomUUID, RandomUUIDOptions } from "node:crypto";

export function createId(
  options?: RandomUUIDOptions,
): ReturnType<typeof randomUUID> {
  return randomUUID(options);
}
