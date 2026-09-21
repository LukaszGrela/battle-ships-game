const GRID_SIZE = 4;
const ITEMS_PER_ATLAS = GRID_SIZE * GRID_SIZE; // 16

export function mapIndexToAtlas(n: number) {
  if (n < 0 || n >= 48) {
    throw new Error("Liczba poza zakresem <0..48)");
  }

  const atlas = Math.floor(n / ITEMS_PER_ATLAS);
  const localIndex = n % ITEMS_PER_ATLAS;

  const x = localIndex % GRID_SIZE;
  const y = Math.floor(localIndex / GRID_SIZE);

  return { atlas, x, y };
}
