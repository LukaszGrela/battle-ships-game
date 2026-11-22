import type { IPRNGState } from "./random";

/**
 * Raised when a saved bot snapshot cannot be trusted. The state restore flow
 * treats it like any other deserialize error: the room is closed instead of
 * being resumed with a half-broken opponent.
 */
export class BotStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotStateError";
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readRecord = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new BotStateError(`${path}: expected an object`);
  }

  return value;
};

export const readString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new BotStateError(`${path}: expected a non-empty string`);
  }

  return value;
};

export const readInt = (
  value: unknown,
  path: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  if (
    !Number.isInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  ) {
    throw new BotStateError(
      `${path}: expected an integer between ${min} and ${max}`,
    );
  }

  return value as number;
};

export const readNumber = (
  value: unknown,
  path: string,
  min: number,
  max: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new BotStateError(
      `${path}: expected a number between ${min} and ${max}`,
    );
  }

  return value;
};

export const readBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== "boolean") {
    throw new BotStateError(`${path}: expected a boolean`);
  }

  return value;
};

export const readArray = <T>(
  value: unknown,
  path: string,
  readItem: (item: unknown, itemPath: string) => T,
): T[] => {
  if (!Array.isArray(value)) {
    throw new BotStateError(`${path}: expected an array`);
  }

  return value.map((item, index) => readItem(item, `${path}[${index}]`));
};

export const readPRNGState = (value: unknown, path: string): IPRNGState => {
  const record = readRecord(value, path);

  return {
    seed: readInt(record.seed, `${path}.seed`, 0, 0xffffffff),
    cursor: readInt(record.cursor, `${path}.cursor`, 0, 0xffffffff),
  };
};
