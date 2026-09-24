import type { CSSProperties } from "react";

const ATLAS_SIZE = 1024;
const CELL_SIZE = 256;

export function getSpriteStyle(
  sprite: { x: number; y: number },
  displaySize: number = CELL_SIZE,
  atlasUrl = 'url("/assets/decoration-sprites.png")',
): CSSProperties {
  const scale = displaySize / CELL_SIZE;

  return {
    width: displaySize,
    height: displaySize,
    backgroundImage: atlasUrl,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${ATLAS_SIZE * scale}px ${ATLAS_SIZE * scale}px`,
    backgroundPosition: `${-sprite.x * scale}px ${-sprite.y * scale}px`,
  };
}
