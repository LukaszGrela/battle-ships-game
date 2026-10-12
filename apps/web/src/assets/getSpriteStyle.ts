import type { CSSProperties } from "react";

const ATLAS_SIZE = 1024;
const CELL_SIZE = 256;

export function getSpriteStyle(
  sprite: { x: number; y: number },
  displaySize: number = CELL_SIZE,
  atlasUrl = 'url("/assets/decoration-sprites.png")',
  cellSize = CELL_SIZE,
  atlasSizeWidth = ATLAS_SIZE,
  atlasSizeHeight = ATLAS_SIZE,
): CSSProperties {
  const scale = displaySize / cellSize;

  return {
    width: displaySize,
    height: displaySize,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${atlasSizeWidth * scale}px ${atlasSizeHeight * scale}px`,
    backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
    ...(atlasUrl && { backgroundImage: atlasUrl }),
  };
}
