import { TShip } from "@repo/types";
import { CELL, SHIP_ATLAS_CELL } from "../../utils/ships/constants";

export function drawShip(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ship: TShip & { type: "placed" | "pending" },
  cell = CELL,
  atlasCell = SHIP_ATLAS_CELL,
) {
  const atlasScale = cell / atlasCell;
  const px = (ship.coords?.x ?? 0) * cell;
  const py = (ship.coords?.y ?? 0) * cell;
  const len = ship.size;

  // ── skala arkusz → canvas ────────────────────────

  // ── źródło: ZAWSZE w pikselach arkusza ───────────
  // pas 3 kolumn (zaokrąglenie kadłuba + szczątki)
  const cols = 3;
  const src = { sx: 0, sy: 0, sw: cols * atlasCell, sh: len * atlasCell };
  // ── cel: ZAWSZE w pikselach canvasa ──────────────
  const dw = src.sw * atlasScale;
  const dh = src.sh * atlasScale;

  const vertical = ship.orientation === "vertical";

  // ── jedno miejsce rysowania: używane i dla poświaty, i dla statku ──
  const paint = () => {
    if (vertical) {
      // środkowa kolumna pasa ma wypaść na kolumnie statku
      const dx = px - cell;
      ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, py, dw, dh);
      return;
    }

  // ── H: obrót -90° wokół rufy ─────────────────────
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-Math.PI / 2);

  // pas 3-kolumnowy: lx = -2*cell
    const lx = -((cols + 1) / 2) * cell;
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, lx, 0, dw, dh);
    ctx.restore();
  };
  
  if (ship.type === "pending" && ship.placed && ship.selected) {
    // cień liczony z kanału alfa PNG → dokładnie kształt statku
    ctx.save();
    ctx.shadowColor = "rgba(239, 68, 68, 0.95)";
    ctx.shadowBlur = cell * 0.9;
    paint();

    // druga, ciaśniejsza warstwa = mocniejszy „rdzeń” poświaty
    ctx.shadowBlur = cell * 0.45;
    paint();
    ctx.restore();
  }

  paint(); // właściwy statek zawsze na wierzchu
}
