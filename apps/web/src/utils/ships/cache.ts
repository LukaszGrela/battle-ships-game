const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!cache.has(src)) {
    cache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }),
    );
  }
  return cache.get(src)!;
}

// np. /ships/ship-3.png dla trzymasztowca
export const shipSrc = (length: number) => `/ships/ship-64-${length}.png`;
export const shipDestroyedSrc = (length: number) =>
  `/ships/ship-64-${length}-destroyed.png`;
