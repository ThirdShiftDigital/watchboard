import { addDays, formatHired, formatShort } from "./dates";
import { downloadBlob } from "./share";
import { WEEKDAY_SHORT, type Agency, type CalendarEvent, type Officer, type TimeOffRequest } from "./types";
import { statusForOfficer } from "./watch-logic";

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(text: string): string {
  return text.replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, " ");
}

type Cell = { text: string; fill?: [number, number, number]; color?: [number, number, number] };
type PatchImage = { width: number; height: number; rgb: Uint8Array };

function streamFor(input: {
  weekStart: string;
  officers: Officer[];
  requests: TimeOffRequest[];
  events: CalendarEvent[];
  effectiveDate: string;
  rdoOnly: boolean;
  showDates: boolean;
  weeks: number;
  columnDates: boolean;
  agencyName: string;
  agencyShort: string;
  hasPatch: boolean;
}): string {
  const {
    weekStart,
    officers,
    effectiveDate,
    rdoOnly,
    showDates,
    weeks,
    columnDates,
    agencyName,
    agencyShort,
    hasPatch,
  } = input;
  const requests = rdoOnly ? [] : input.requests;
  const events = rdoOnly ? [] : input.events;
  const pageW = 792;
  const pageH = 612;
  const marginX = 18;
  const top = 578;
  const ops: string[] = [];

  const cols = [
    { key: "name", w: 142, align: "left" as const },
    { key: "hired", w: 50, align: "left" as const },
    { key: "srt", w: 26, align: "center" as const },
    { key: "rn", w: 26, align: "center" as const },
    { key: "unit", w: 30, align: "center" as const },
    ...WEEKDAY_SHORT.map((d, i) => ({
      key: `d${i}`,
      w: 64,
      align: "center" as const,
      label: `${d} ${Number(addDays(weekStart, i).slice(8))}`,
    })),
  ];

  function text(
    x: number,
    y: number,
    value: string,
    opts?: { bold?: boolean; size?: number; color?: [number, number, number] },
  ) {
    const size = opts?.size ?? 8;
    const font = opts?.bold ? "F2" : "F1";
    const [r, g, b] = opts?.color ?? [0.12, 0.13, 0.14];
    ops.push(
      "BT",
      `/${font} ${size} Tf`,
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
      `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
      `(${pdfEscape(ascii(value))}) Tj`,
      "ET",
    );
  }

  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: [number, number, number] | null,
    stroke: boolean,
  ) {
    if (fill) {
      ops.push(`${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg`);
      ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    }
    if (stroke) {
      ops.push("0.55 0.56 0.58 RG 0.4 w");
      ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  }

  const titleX = hasPatch ? marginX + 78 : marginX;
  if (hasPatch) {
    ops.push("q", "64 0 0 64 18 518 cm", "/Im1 Do", "Q");
  }

  const title = rdoOnly ? "RDO SCHEDULE" : "SHIFT SCHEDULE";
  text(titleX, top, title, { bold: true, size: 16, color: [0.08, 0.09, 0.1] });
  text(
    titleX,
    top - 14,
    ascii(agencyName || "WATCH BOARD").toUpperCase(),
    { size: 9, color: [0.25, 0.32, 0.14] },
  );
  const effectiveText = `EFFECTIVE ${formatHired(effectiveDate) || effectiveDate || "—"}`;
  const spanEnd = addDays(weekStart, Math.max(1, weeks) * 7 - 1);
  const rangeText = `${formatShort(weekStart).toUpperCase()} - ${formatShort(spanEnd).toUpperCase()}`;
  const sub =
    rdoOnly && !showDates
      ? effectiveText
      : `${rangeText}   ${effectiveText}`;
  text(titleX, top - 26, sub, { size: 8, color: [0.35, 0.37, 0.4] });
  text(pageW - marginX - 130, top, agencyShort || "WATCH BOARD", { bold: true, size: 10, color: [0.35, 0.37, 0.4] });
  text(
    pageW - marginX - 130,
    top - 12,
    rdoOnly ? "RDO ONLY" : "INCLUDES LEAVE",
    { size: 7, color: [0.5, 0.52, 0.55] },
  );

  const tableTop = hasPatch ? top - 62 : top - 44;
  const rowH = 22;
  const headerH = 20;

  const headers: Cell[] = [
    { text: "OFFICER", fill: [0.22, 0.24, 0.27], color: [1, 1, 1] },
    { text: "HIRED", fill: [0.22, 0.24, 0.27], color: [1, 1, 1] },
    { text: "SRT", fill: [0.22, 0.24, 0.27], color: [1, 1, 1] },
    { text: "S", fill: [0.22, 0.24, 0.27], color: [1, 1, 1] },
    { text: "UNIT", fill: [0.22, 0.24, 0.27], color: [1, 1, 1] },
    ...WEEKDAY_SHORT.map((d, i) => ({
      text: columnDates ? `${d} ${Number(addDays(weekStart, i).slice(8))}` : d,
      fill: [0.22, 0.24, 0.27] as [number, number, number],
      color: [1, 1, 1] as [number, number, number],
    })),
  ];

  function drawRow(cells: Cell[], y: number, h: number) {
    let x = marginX;
    cells.forEach((cell, i) => {
      const col = cols[i]!;
      rect(x, y, col.w, h, cell.fill ?? null, true);
      const size = 7.5;
      const tw = ascii(cell.text).length * size * 0.48;
      const tx = col.align === "center" ? x + col.w / 2 - tw / 2 : x + 4;
      const ty = y + h / 2 - 2.6;
      text(Math.max(x + 2, tx), ty, cell.text, {
        size,
        color: cell.color,
        bold: i === 0 || Boolean(cell.fill && cell.text === "RDO"),
      });
      x += col.w;
    });
  }

  drawRow(headers, tableTop - headerH, headerH);

  let y = tableTop - headerH;
  const counts = [0, 0, 0, 0, 0, 0, 0];

  officers.forEach((officer, rowIndex) => {
    y -= rowH;
    const stripe: [number, number, number] | undefined = rowIndex % 2 === 1 ? [0.96, 0.97, 0.97] : [1, 1, 1];
    const dayCells: Cell[] = WEEKDAY_SHORT.map((_, weekday) => {
      const iso = addDays(weekStart, weekday);
      const s = statusForOfficer(officer, weekday, iso, requests, events);
      if (s.status === "working") {
        counts[weekday] += 1;
        return { text: "", fill: stripe };
      }
      if (s.status === "rdo") {
        return { text: "RDO", fill: [0.82, 0.83, 0.85], color: [0.2, 0.22, 0.24] };
      }
      return {
        text: s.statusLabel.slice(0, 4),
        fill: [0.93, 0.8, 0.8],
        color: [0.55, 0.16, 0.16],
      };
    });
    drawRow(
      [
        { text: officer.name.slice(0, 22), fill: stripe, color: [0.1, 0.11, 0.12] },
        { text: formatHired(officer.hireDate), fill: stripe },
        { text: officer.tmt ? "X" : "", fill: stripe },
        { text: officer.radioNum != null ? String(officer.radioNum) : "", fill: stripe },
        { text: officer.unit, fill: stripe },
        ...dayCells,
      ],
      y,
      rowH,
    );
  });

  y -= rowH;
  drawRow(
    [
      { text: "TOTAL", fill: [0.98, 0.93, 0.72], color: [0.2, 0.18, 0.1] },
      { text: "", fill: [0.98, 0.93, 0.72] },
      { text: "", fill: [0.98, 0.93, 0.72] },
      { text: "", fill: [0.98, 0.93, 0.72] },
      { text: String(officers.length), fill: [0.98, 0.93, 0.72] },
      ...counts.map((n) => ({
        text: String(n),
        fill: [0.98, 0.93, 0.72] as [number, number, number],
        color: [0.2, 0.18, 0.1] as [number, number, number],
      })),
    ],
    y,
    rowH,
  );

  text(
    marginX,
    28,
    rdoOnly
      ? "Gray = regular day off only. Approved leave and calendar days are treated as on duty. X = SRT. S = seniority below CPL."
      : "Gray = regular day off. Red = approved leave. X = SRT. S = seniority below CPL from hire date (1 is most senior).",
    { size: 7, color: [0.45, 0.47, 0.5] },
  );
  void pageH;
  return ops.join("\n");
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function assemblePdf(content: string, image?: PatchImage): Uint8Array {
  const enc = new TextEncoder();
  const contentBytes = enc.encode(content);
  const pageResources = image
    ? "<< /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R >> >>"
    : "<< /Font << /F1 4 0 R /F2 5 0 R >> >>";

  const objects: Uint8Array[] = [
    enc.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    enc.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    enc.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources ${pageResources} /Contents 6 0 R >>`,
    ),
    enc.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    enc.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    concat([
      enc.encode(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      enc.encode("\nendstream"),
    ]),
  ];
  if (image) {
    objects.push(
      concat([
        enc.encode(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${image.rgb.length} >>\nstream\n`,
        ),
        image.rgb,
        enc.encode("\nendstream"),
      ]),
    );
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    cursor += bytes.length;
  };
  push(enc.encode("%PDF-1.4\n"));
  objects.forEach((body, i) => {
    offsets.push(cursor);
    push(enc.encode(`${i + 1} 0 obj\n`));
    push(body);
    push(enc.encode("\nendobj\n"));
  });
  const xrefStart = cursor;
  push(enc.encode(`xref\n0 ${objects.length + 1}\n`));
  push(enc.encode("0000000000 65535 f \n"));
  for (let i = 1; i <= objects.length; i += 1) {
    push(enc.encode(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`));
  }
  push(
    enc.encode(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
    ),
  );
  return concat(chunks);
}

async function decodePatch(dataUrl: string): Promise<PatchImage | null> {
  if (!dataUrl.startsWith("data:image/") || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 192;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const pad = 8;
      const scale = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const { data } = ctx.getImageData(0, 0, size, size);
      const rgb = new Uint8Array(size * size * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        const a = data[i + 3]! / 255;
        rgb[j] = Math.round(data[i]! * a + 255 * (1 - a));
        rgb[j + 1] = Math.round(data[i + 1]! * a + 255 * (1 - a));
        rgb[j + 2] = Math.round(data[i + 2]! * a + 255 * (1 - a));
      }
      resolve({ width: size, height: size, rgb });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function buildRdoPdf(input: {
  weekStart: string;
  officers: Officer[];
  requests: TimeOffRequest[];
  events: CalendarEvent[];
  effectiveDate: string;
  rdoOnly?: boolean;
  showDates?: boolean;
  weeks?: number;
  agency?: Agency | null;
}): Promise<{ bytes: Uint8Array; filename: string }> {
  const rdoOnly = Boolean(input.rdoOnly);
  const showDates = rdoOnly ? Boolean(input.showDates) : true;
  const weeks = Math.min(12, Math.max(1, input.weeks ?? 1));
  const columnDates = !rdoOnly;
  const patch = input.agency?.patchData ? await decodePatch(input.agency.patchData) : null;
  const content = streamFor({
    weekStart: input.weekStart,
    officers: input.officers,
    requests: input.requests,
    events: input.events,
    effectiveDate: input.effectiveDate,
    rdoOnly,
    showDates,
    weeks,
    columnDates,
    agencyName: input.agency?.name ?? "WatchBoard",
    agencyShort: input.agency?.shortName ?? "",
    hasPatch: Boolean(patch),
  });
  const bytes = assemblePdf(content, patch ?? undefined);
  const tag = rdoOnly ? "RDO" : "Schedule";
  const filename = rdoOnly && !showDates ? `${tag}.pdf` : `${tag}-${input.weekStart}.pdf`;
  return { bytes, filename };
}

export async function shareRdoPdf(bytes: Uint8Array, filename: string): Promise<"shared" | "downloaded"> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename.startsWith("RDO") ? "RDO Schedule" : "Shift Schedule" });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadRdoPdf(bytes: Uint8Array, filename: string) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(new Blob([copy], { type: "application/pdf" }), filename);
}

export async function fileToPatchDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.clearRect(0, 0, size, size);
  const pad = 16;
  const scale = Math.min((size - pad * 2) / bitmap.width, (size - pad * 2) / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > 450_000) dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  if (dataUrl.length > 450_000) throw new Error("Patch image is too large. Use a simpler PNG.");
  return dataUrl;
}
