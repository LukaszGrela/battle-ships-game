import { paddedArray } from './paddedArray';

describe('paddedArray', () => {
  it('returns the original array when padding is zero or negative', () => {
    const array = [1, 2, 3];

    expect(paddedArray(array, 0, () => -1)).toBe(array);
    expect(paddedArray(array, -1, () => -1)).toBe(array);
    expect(array).toEqual([1, 2, 3]);
  });

  it('adds one generated value to each end', () => {
    expect(paddedArray([1, 2, 3], 1, () => -1)).toEqual([
      -1, 1, 2, 3, -1,
    ]);
  });

  it('adds the requested number of generated values to each end', () => {
    expect(paddedArray([1, 2, 3], 2, () => -1)).toEqual([
      -1, -1, 1, 2, 3, -1, -1,
    ]);
  });

  it('pads an empty array on both ends', () => {
    expect(paddedArray([], 2, () => 'padding')).toEqual([
      'padding', 'padding', 'padding', 'padding',
    ]);
  });

  it('calls the padding factory separately for each new element without mutating the input', () => {
    const array = [1, 2];
    let nextPadding = 0;

    const result = paddedArray<number, string>(array, 2, () => `pad-${++nextPadding}`);

    expect(result).toEqual(['pad-3', 'pad-1', 1, 2, 'pad-2', 'pad-4']);
    expect(nextPadding).toBe(4);
    expect(array).toEqual([1, 2]);
  });
});