import { TShip } from "@repo/types";
import { CELL } from "../../utils/ships/constants";


export function drawShip(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ship: TShip & { type: "placed" | "pending" },
) {
  const px = (ship.coords?.x ?? 0) * CELL; // rufa = kotwica
  const py = (ship.coords?.y ?? 0) * CELL;
  const len = ship.size;

  // ── źródło w arkuszu ──────────────────────────────
  // wrak: cały pas 3 kolumn (szczatki po bokach)
  const src = { sx: 0, sy: 0, sw: 3 * CELL, sh: len * CELL };

  if (ship.orientation === "vertical") {
    // środkowa kolumna arkusza ma wypaść DOKŁADNIE na kolumnie statku:
    // intact: pas 1-kolumnowy → dst x = px
    // wreck:  pas 3-kolumnowy → dst x = px - CELL (środkowa kolumna pasa = kolumna statku)
    const dx = src.sw === CELL ? px : px - CELL;
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, py, src.sw, src.sh);
    return;
  }

  // ── H: obrót -90° wokół rufy (bez zmian w koncepcji) ──
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-Math.PI / 2);

  // transform: world.x = local.y, world.y = -local.x
  // local x ∈ [-dw, -dw+lw] musi mapować się na world y ∈ [py - CELL, py + 2*CELL]
  //   → intact (lw = CELL):      local x = -CELL
  //   → wreck  (lw = 3*CELL):    local x = -2*CELL
  const lx = src.sw === CELL ? -CELL : -2 * CELL;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, lx, 0, src.sw, src.sh);
  ctx.restore();
}
