import { paddedArray } from "./paddedArray";

export const paddedGrid = <T, C>(
  array: T[][],
  pad: number,
  paddedContent: () => C,
): Array<T | C>[] => {
  if (pad <= 0) return array as Array<T | C>[];

  const list = array.concat().map((row) => {
    // dodaj padding - (ekstra kolumny)
    return paddedArray(row, pad, paddedContent);
  });

  const emptyRow = () => {
    const rowsLength = array.at(0)?.length ?? 0;
    return Array.from(Array(rowsLength + pad * 2)).map(() => paddedContent());
  };
  // dodaj padding - ekstra wiersze
  return paddedArray<(T | C)[], C[]>(list, pad, emptyRow) as Array<T | C>[];
};
