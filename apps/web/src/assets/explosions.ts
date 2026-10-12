const CELL = 64;

export const EXPLOSION_ATLAS =
  /* 4 x 4 */
  Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => ({
      x: col * CELL,
      y: row * CELL,
    })),
  )
    .flat()
    .reduce(
      (acc, frame, index) => {
        acc[`frame${index + 1}`] = frame;

        return acc;
      },
      {} as Record<string, { x: number; y: number }>,
    );

export type TExplosionSprite = keyof typeof EXPLOSION_ATLAS;
export const EXPLOSION_SPRITES: TExplosionSprite[] = Object.keys(
  EXPLOSION_ATLAS,
) as TExplosionSprite[];
