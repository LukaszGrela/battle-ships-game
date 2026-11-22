import { randomUUID } from "node:crypto";
import type { RandomUUIDOptions } from "node:crypto";

export function createId(
  options?: RandomUUIDOptions,
): ReturnType<typeof randomUUID> {
  return randomUUID(options);
}
