export const paddedArray = <T, C = T>(
  array: T[],
  pad: number,
  paddedContent: () => C,
): (T | C)[] => {
  if (pad <= 0) return array;

  // shift and push
  const paddedList = array.concat() as (T | C)[];
  let i = 0;
  while (i < pad) {
    i++;
    // start and end
    paddedList.unshift(paddedContent());
    paddedList.push(paddedContent());
  }

  return paddedList as T[];
};


/*
console.group("TEST PADDED ARRAY");
console.log(
  "EMPTY",
  paddedArray([], 0, () => {}),
);
console.log(
  "EMPTY",
  paddedArray([1, 2, 3], 0, () => -1),
);
console.log(
  "EMPTY",
  paddedArray([1, 2, 3], -1, () => -1),
);
console.log(
  "PAD 1",
  paddedArray([1, 2, 3], 1, () => -1),
);
console.log(
  "PAD 2",
  paddedArray([1, 2, 3], 2, () => -1),
);
console.log(
  "PAD 3",
  paddedArray([1, 2, 3], 3, () => -1),
);
console.groupEnd();
console.group("TEST PADDED GRID");
console.log(
  "EMPTY",
  paddedGrid([], 0, () => {}),
);
console.log(
  "EMPTY",
  paddedGrid([[1, 2, 3]], 0, () => -1),
);
console.log(
  "EMPTY",
  paddedGrid([[1, 2, 3]], -1, () => -1),
);
console.log(
  "PAD 1",
  paddedGrid([[1, 2, 3]], 1, () => -1),
);
console.log(
  "PAD 2",
  paddedGrid([[1, 2, 3]], 2, () => -1),
);
console.log(
  "PAD 3",
  paddedGrid([[1, 2, 3]], 3, () => -1),
);
console.groupEnd();
*/
