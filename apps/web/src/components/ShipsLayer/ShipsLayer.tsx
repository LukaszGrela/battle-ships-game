import styles from "../Board/BoardGrid.module.css";
import ownStyles from "./ShipsLayer.module.css";
import { FC, useEffect, useRef } from "react";
import { BoardGridContainer } from "../Board/BoardGridContainer";
import { classNames } from "../../utils/classNames";
import { TShip } from "@repo/types";
import { useShipImages } from "../../utils/ships/useShipImages";
import { CELL, GRID_PAD, GRID_SIZE } from "../../utils/ships/constants";
import { drawShip } from "./drawShip";
import { isSunk } from "@repo/game-logic";

export const ShipsLayer: FC<{
  className?: string;
  rows: number;
  columns: number;
  ships: TShip[];
  pad?: number;
  gridCellSize?: number;
}> = ({
  className,
  ships,
  rows = GRID_SIZE,
  columns = GRID_SIZE,
  gridCellSize = CELL,
  pad = GRID_PAD,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useShipImages(ships);
  console.log("[ShipsLayer]", images);
  console.log("[ShipsLayer]", ships);

  const canvasPxW = columns * gridCellSize + 2 * pad;
  const canvasPxH = rows * gridCellSize + 2 * pad;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (ships.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasPxW * dpr;
    canvas.height = canvasPxH * dpr;

    // reset + skala DPR + przesunięcie o margines:
    // od tego momentu rysujemy w WSPÓŁRZĘDNYCH PLANSZY (0..BOARD_PX)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(gridCellSize * pad, gridCellSize * pad);

    // czyścimy CAŁY canvas — w tym marginesy (translate dotyczy tylko rysowania)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (const ship of ships) {
      console.log("Ship size", ship.size);
      if (ship.type !== "pending" && ship.type !== "placed") continue;
      if (ship.type === "pending" && !ship.placed) continue;

      if (!images[ship.size]) {
        console.warn("Not found image sources for ship size", ship.size);
        continue;
      }
      const [img, destroyedImg] = images[ship.size] as [
        ship: HTMLImageElement,
        destroyed: HTMLImageElement,
      ];

      if (!img) continue;

      if (!isSunk(ship)) {
        drawShip(ctx, img, ship, gridCellSize);
        if (ship.type === "placed") {
          ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
          for (const { x, y } of ship.hits) {
            ctx.beginPath();
            ctx.arc(
              x * gridCellSize + gridCellSize / 2,
              y * gridCellSize + gridCellSize / 2,
              gridCellSize * 0.22,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.strokeStyle = "rgba(220, 38, 38, 0.85)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(
              x * gridCellSize + gridCellSize / 2,
              y * gridCellSize + gridCellSize / 2,
              gridCellSize * 0.32,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
        }
      } else {
        drawShip(ctx, destroyedImg, ship, gridCellSize);
      }
    }
  }, [ships, images, pad, gridCellSize, canvasPxW, canvasPxH]);

  return (
    <BoardGridContainer
      rows={rows}
      columns={columns}
      className={classNames(styles.BoardGrid, ownStyles.ShipsLayer, className)}
      hideColumnLabels
      hideRowLabels
      pad={pad}
      gridCellSize={gridCellSize}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          width: canvasPxW,
          height: canvasPxH,
          pointerEvents: "none",
        }}
      />
    </BoardGridContainer>
  );
};
