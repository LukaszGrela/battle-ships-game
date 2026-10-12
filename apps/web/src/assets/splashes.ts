const CELL = 64;

export const SPLASH_ATLAS =
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

export type TSplashSprite = keyof typeof SPLASH_ATLAS;
export const SPLASH_SPRITES: TSplashSprite[] = Object.keys(
  SPLASH_ATLAS,
) as TSplashSprite[];
