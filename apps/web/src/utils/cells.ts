const CELL = 32;
export const cellToPx = (x: number, y: number) => ({
  px: x * CELL,
  py: y * CELL,
});

export const pxToCell = (px: number, py: number) => ({
  x: Math.floor(px / CELL),
  y: Math.floor(py / CELL),
});
