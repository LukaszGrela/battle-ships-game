import { paddedGrid } from './paddedGrid';

describe('paddedGrid', () => {
  it('returns the original grid when padding is zero or negative', () => {
    const grid = [[1, 2], [3, 4]];

    expect(paddedGrid(grid, 0, () => -1)).toBe(grid);
    expect(paddedGrid(grid, -1, () => -1)).toBe(grid);
    expect(grid).toEqual([[1, 2], [3, 4]]);
  });

  it('pads rows and columns on every side', () => {
    expect(paddedGrid([[1, 2], [3, 4]], 1, () => -1)).toEqual([
      [-1, -1, -1, -1],
      [-1, 1, 2, -1],
      [-1, 3, 4, -1],
      [-1, -1, -1, -1],
    ]);
  });

  it('adds the requested padding width on every side', () => {
    expect(paddedGrid([[1]], 2, () => 0)).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
  });

  it('pads an empty grid', () => {
    expect(paddedGrid([], 1, () => 'padding')).toEqual([
      ['padding', 'padding'],
      ['padding', 'padding'],
    ]);
  });

  it('does not mutate the input grid', () => {
    const grid = [[1, 2], [3, 4]];

    paddedGrid(grid, 1, () => -1);

    expect(grid).toEqual([[1, 2], [3, 4]]);
  });
});