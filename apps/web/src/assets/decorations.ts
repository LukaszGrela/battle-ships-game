const CELL = 256;

export const DECOR_SPRITES = {
  jollyRoger: { x: 0 * CELL, y: 0 * CELL },
  barrel: { x: 1 * CELL, y: 0 * CELL },
  treasureChest: { x: 2 * CELL, y: 0 * CELL }, // zamknięta skrzynia skarbów
  anchor: { x: 3 * CELL, y: 0 * CELL },

  steeringWheel: { x: 0 * CELL, y: 1 * CELL },
  cannon: { x: 1 * CELL, y: 1 * CELL },
  treasureMap: { x: 2 * CELL, y: 1 * CELL },
  lantern: { x: 3 * CELL, y: 1 * CELL },

  chest: { x: 0 * CELL, y: 2 * CELL }, // zwykła skrzynia
  moneyBag: { x: 1 * CELL, y: 2 * CELL },
  pirateHat: { x: 2 * CELL, y: 2 * CELL },
  lifebuoy: { x: 3 * CELL, y: 2 * CELL },

  crossroads: { x: 0 * CELL, y: 3 * CELL },
  skull: { x: 1 * CELL, y: 3 * CELL },
  palmTree: { x: 2 * CELL, y: 3 * CELL },
  crossedSabres: { x: 3 * CELL, y: 3 * CELL },
} as const;

export type TDecorSprite = keyof typeof DECOR_SPRITES;

/** Sprite'y dla danego wyniku — losowany moduł. */
export const VICTORY_SPRITES: TDecorSprite[] = [
  "treasureChest",
  "moneyBag",
  "jollyRoger",
  "pirateHat",
  "treasureMap",
];

export const DEFEAT_SPRITES: TDecorSprite[] = [
  "skull",
  "lifebuoy",
  "crossedSabres",
  "anchor",
  "cannon",
];
