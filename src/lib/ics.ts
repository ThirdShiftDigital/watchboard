import { addDays } from "./dates";
import type { CalendarEvent, Officer } from "./types";
import { matchOfficersToEvent } from "./watch-logic";

export function normalizeFeedUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (/^webcal:/i.test(url)) url = url.replace(/^webcal:/i, "https:");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That is not a valid calendar link.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Use an https iCal link (Google, Outlook, Apple, or exported .ics).");
  }
  return parsed.toString();
}

export function parseIcsEvents(
  ics: string,
  officers: Officer[],
  rangeStart: string,
  rangeEnd: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let index = 0;
  for (const block of splitEvents(unfold(ics))) {
    const summary = unescapeIcs(prop(block, "SUMMARY") ?? "Untitled event");
    const uid = prop(block, "UID") || `ics-${index}`;
    const startRaw = prop(block, "DTSTART");
    if (!startRaw) continue;
    const startParsed = parseIcsDate(startRaw);
    if (!startParsed) continue;
    const endRaw = prop(block, "DTEND");
    let endParsed = endRaw ? parseIcsDate(endRaw) : null;
    if (startParsed.allDay) {
      if (endParsed) {
        endParsed = { iso: addDays(endParsed.iso.slice(0, 10), -1), allDay: true };
        if (endParsed.iso < startParsed.iso.slice(0, 10)) {
          endParsed = { iso: startParsed.iso.slice(0, 10), allDay: true };
        }
      } else {
        endParsed = { iso: startParsed.iso.slice(0, 10), allDay: true };
      }
    }
    const start = startParsed.iso;
    const end = endParsed?.iso ?? null;
    const startDay = start.slice(0, 10);
    const endDay = (end ?? start).slice(0, 10);
    if (endDay < rangeStart || startDay > rangeEnd) {
      index += 1;
      continue;
    }
    events.push({
      id: uid,
      title: summary,
      start,
      end,
      allDay: startParsed.allDay,
      matchedOfficerIds: matchOfficersToEvent(summary, officers),
    });
    index += 1;
  }
  return events;
}

function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function splitEvents(lines: string[]): string[][] {
  const events: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  return events;
}

function prop(block: string[], name: string): string | null {
  const prefix = `${name.toUpperCase()}`;
  for (const line of block) {
    const cut = line.indexOf(":");
    if (cut < 0) continue;
    const key = line.slice(0, cut).split(";")[0]?.toUpperCase();
    if (key === prefix) return line.slice(cut + 1);
  }
  return null;
}

function parseIcsDate(value: string): { iso: string; allDay: boolean } | null {
  const compact = value.trim();
  const dateOnly = compact.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return { iso: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, allDay: true };
  }
  const dateTime = compact.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dateTime) {
    return {
      iso: `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}T${dateTime[4]}:${dateTime[5]}:${dateTime[6]}`,
      allDay: false,
    };
  }
  return null;
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
