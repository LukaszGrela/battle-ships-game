import { TShip } from "@repo/types";
import {
  CELL,
  SHIP_ATLAS_SCALE,
  SHIP_ATLAS_CELL,
} from "../../utils/ships/constants";

export function drawShip(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ship: TShip & { type: "placed" | "pending" },
) {
  const px = (ship.coords?.x ?? 0) * CELL;
  const py = (ship.coords?.y ?? 0) * CELL;
  const len = ship.size;

  // ── skala arkusz → canvas ────────────────────────

  // ── źródło: ZAWSZE w pikselach arkusza ───────────
  // pas 3 kolumn (zaokrąglenie kadłuba + szczątki)
  const cols = 3; // zmień na 1 dla sprite'a "intact" jednokolumnowego
  const src = {
    sx: 0,
    sy: 0,
    sw: cols * SHIP_ATLAS_CELL, // 3 → 192
    sh: len * SHIP_ATLAS_CELL, // len * 64 (np. 5 → 320)
  };

  // ── cel: ZAWSZE w pikselach canvasa ──────────────
  const dw = src.sw * SHIP_ATLAS_SCALE; // = cols * CELL
  const dh = src.sh * SHIP_ATLAS_SCALE; // = len * CELL

  if (ship.orientation === "vertical") {
    // środkowa kolumna pasa ma wypaść na kolumnie statku
    const dx = px - CELL;
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, py, dw, dh);
    return;
  }

  // ── H: obrót -90° wokół rufy ─────────────────────
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-Math.PI / 2);

  // intact (1 kolumna): lx = -CELL, pas 3-kolumnowy: lx = -2*CELL
  const lx = -((cols + 1) / 2) * CELL;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, lx, 0, dw, dh);
  ctx.restore();
}
