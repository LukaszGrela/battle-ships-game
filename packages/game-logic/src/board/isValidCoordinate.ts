import { TCoordinate } from "@repo/types";

/**
 * Validates if a coordinate is within the 10x10 grid boundaries.
 */
export const isValidCoordinate = (coord: TCoordinate): boolean =>
  coord.x >= 0 && coord.x < 10 && coord.y >= 0 && coord.y < 10;
