import { formatLong } from "./dates";
import { downloadBlob } from "./share";
import { DEFAULT_ZONE_ORDER, orderedZones, zoneHint } from "./types";
import type { WatchRow } from "./types";
import { postedWatchRows } from "./watch-text";

const BG = "#0c0d0f";
const CARD = "#141518";
const HEADER = "#16181c";
const ROW_ALT = "#1b1d21";
const BORDER = "#2a2d33";
const FG = "#eceef1";
const MUTED = "#8d929c";
const PRIMARY = "#7a9b3a";
const SILVER = "#c9cdd3";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function renderWatchPng(input: {
  date: string;
  rows: WatchRow[];
  zoneOrder?: string[];
  audience: "shift" | "dispatch";
}): Promise<File> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  const order = input.zoneOrder ?? DEFAULT_ZONE_ORDER;
  const posted = postedWatchRows(input.rows, order);
  const open =
    input.audience === "dispatch"
      ? orderedZones(order).filter((z) => z.id !== "ALL" && !posted.some((r) => r.zone === z.id))
      : [];

  const scale = 2;
  const width = 1080;
  const pad = 48;
  const titleH = 168;
  const colH = 52;
  const rowH = 78;
  const openH = open.length ? 96 : 0;
  const height = titleH + colH + Math.max(posted.length, 1) * rowH + openH + pad;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the watch image.");
  ctx.scale(scale, scale);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = HEADER;
  ctx.fillRect(0, 0, width, titleH);

  ctx.font = "700 28px Inter, 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = SILVER;
  ctx.fillText("WATCH", pad, 52);
  const watchW = ctx.measureText("WATCH").width;
  ctx.fillStyle = PRIMARY;
  ctx.fillText("BOARD", pad + watchW, 52);

  ctx.font = "700 44px Inter, 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = FG;
  ctx.fillText(input.audience === "dispatch" ? "DISPATCH ZONES" : "ZONES", pad, 108);

  ctx.font = "600 22px Inter, 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText(formatLong(input.date).toUpperCase(), pad, 142);

  const y0 = titleH;
  ctx.fillStyle = ROW_ALT;
  ctx.fillRect(0, y0, width, colH);
  ctx.font = "600 18px Inter, 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText("DEPUTY", pad, y0 + 34);
  ctx.fillText("UNIT", 620, y0 + 34);
  ctx.fillText("ZONE", 780, y0 + 34);

  if (posted.length === 0) {
    ctx.font = "500 24px Inter, 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText("No zones posted for this date.", pad, y0 + colH + 48);
  } else {
    posted.forEach((row, i) => {
      const y = y0 + colH + i * rowH;
      ctx.fillStyle = i % 2 === 0 ? CARD : BG;
      ctx.fillRect(0, y, width, rowH);
      ctx.fillStyle = BORDER;
      ctx.fillRect(0, y + rowH - 1, width, 1);
      ctx.font = "600 26px Inter, 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = FG;
      ctx.fillText(row.officer.name, pad, y + 48);
      ctx.font = "500 24px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = MUTED;
      ctx.fillText(row.officer.unit, 620, y + 48);
      ctx.font = "700 26px Inter, 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = FG;
      ctx.fillText(row.zone ?? "", 780, y + 48);
    });
  }

  if (open.length) {
    const y = y0 + colH + Math.max(posted.length, 1) * rowH;
    ctx.fillStyle = HEADER;
    ctx.fillRect(0, y, width, openH);
    ctx.font = "600 16px Inter, 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText("OPEN", pad, y + 34);
    ctx.font = "600 22px Inter, 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = FG;
    ctx.fillText(
      open
        .map((z) => {
          const hint = zoneHint(z.id);
          return hint && hint !== z.label ? `${z.id} ${hint}` : z.id;
        })
        .join("  ·  "),
      pad,
      y + 68,
    );
  }

  ctx.fillStyle = PRIMARY;
  roundRect(ctx, width - pad - 72, 36, 72, 8, 4);
  ctx.fill();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save image."))), "image/png");
  });
  const stamp = input.date.replaceAll("-", "");
  const name =
    input.audience === "dispatch" ? `dispatch-zones-${stamp}.png` : `zones-${stamp}.png`;
  return new File([blob], name, { type: "image/png" });
}

export async function shareWatchImage(file: File, title: string): Promise<"shared" | "saved"> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  downloadBlob(file, file.name);
  return "saved";
}

export function downloadWatchImage(file: File) {
  downloadBlob(file, file.name);
}
