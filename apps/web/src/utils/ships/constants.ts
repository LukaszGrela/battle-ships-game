export const GRID_PAD = 1;
export const GRID_SIZE = 10;
export const CELL = 32;
export const BOARD_PX = GRID_SIZE * CELL;

// margines na wraki przy krawędziach planszy
export const PAD = CELL * GRID_PAD;
export const CANVAS_PX = BOARD_PX + 2 * PAD;

// skalowanie obrazka
export const SHIP_ATLAS_CELL = 64;
export const SHIP_ATLAS_SCALE = CELL / SHIP_ATLAS_CELL;
