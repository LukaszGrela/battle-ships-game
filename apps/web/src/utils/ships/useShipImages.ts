import { useEffect, useMemo, useState } from "react";
import { loadImage, shipDestroyedSrc, shipSrc } from "./cache";
import { TShip } from "@repo/types";

type TImagesRecord = Record<
  number,
  [ship: HTMLImageElement, destroyed: HTMLImageElement]
>;

export function useShipImages(ships: TShip[]) {
  const [images, setImages] = useState<TImagesRecord>({});

  const key = useMemo(
    () => [...new Set(ships.map((s) => s.size))].sort().join(","),
    [ships],
  );

  useEffect(() => {
    let cancelled = false;
    const lengths = key ? key.split(",").map(Number) : [];

    Promise.all(
      lengths.map(
        async (len) =>
          [
            len,
            [
              await loadImage(shipSrc(len)),
              await loadImage(shipDestroyedSrc(len)),
            ] as const,
          ] as const,
      ),
    ).then((entries) => {
      if (!cancelled) {
        console.log("[useShipImages]", entries);
        setImages(Object.fromEntries(entries) as TImagesRecord);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return images;
}
