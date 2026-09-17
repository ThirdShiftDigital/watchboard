import { Check, Copy, Download, Image, Mail, MessageSquare, Share2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { SheriffMark } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { copyText, mailtoHref, shareOrCopy, smsHref } from "@/lib/share";
import { DEFAULT_ZONE_ORDER, orderedZones, zoneHint } from "@/lib/types";
import type { WatchRow } from "@/lib/types";
import { renderWatchPng, shareWatchImage, downloadWatchImage } from "@/lib/watch-image";
import {
  dispatchShareTitle,
  formatDispatchList,
  formatShiftList,
  postedWatchRows,
  shiftShareTitle,
} from "@/lib/watch-text";

export function SendSheet({
  date,
  rows,
  zoneOrder = DEFAULT_ZONE_ORDER,
  onClose,
}: {
  date: string;
  rows: WatchRow[];
  zoneOrder?: string[];
  onClose: () => void;
}) {
  const posted = useMemo(() => postedWatchRows(rows, zoneOrder), [rows, zoneOrder]);
  const shiftText = useMemo(
    () => formatShiftList(date, rows, zoneOrder),
    [date, rows, zoneOrder],
  );
  const dispatchText = useMemo(
    () => formatDispatchList(date, rows, zoneOrder),
    [date, rows, zoneOrder],
  );
  const open = useMemo(() => {
    const used = new Set(posted.map((r) => r.zone));
    return orderedZones(zoneOrder).filter((z) => z.id !== "ALL" && !used.has(z.id));
  }, [posted, zoneOrder]);

  const [audience, setAudience] = useState<"shift" | "dispatch">("shift");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"send" | "download" | false>(false);

  const text = audience === "shift" ? shiftText : dispatchText;
  const shareTitle = audience === "shift" ? shiftShareTitle(date) : dispatchShareTitle(date);

  async function sendPhoto() {
    if (posted.length === 0) {
      toast.error("Assign zones before sending a photo.");
      return;
    }
    setBusy("send");
    try {
      const file = await renderWatchPng({ date, rows, zoneOrder, audience });
      const result = await shareWatchImage(file, shareTitle);
      if (result === "shared") toast.success(`Photo sent to ${audience}`);
      if (result === "saved") toast.success("Photo downloaded");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Could not make the photo");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPhoto() {
    if (posted.length === 0) {
      toast.error("Assign zones before downloading.");
      return;
    }
    setBusy("download");
    try {
      const file = await renderWatchPng({ date, rows, zoneOrder, audience });
      downloadWatchImage(file);
      toast.success("Photo downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not make the photo");
    } finally {
      setBusy(false);
    }
  }

  async function shareList() {
    const result = await shareOrCopy(shareTitle, text);
    if (result === "shared") toast.success(`List sent to ${audience}`);
    if (result === "copied") {
      setCopied(true);
      toast.success("Copied — paste into the shift chat");
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function copy() {
    await copyText(text);
    setCopied(true);
    toast.success("List copied");
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-header px-2 py-2">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 items-center justify-center"
          >
            <X className="size-5" />
          </button>
          <SheriffMark className="size-8" />
          <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold uppercase tracking-wider">
            Zones
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="zone-cols grid border-b border-border bg-card-2 px-4 py-2 text-2xs font-medium uppercase tracking-wide-plus text-muted">
            <span>Deputy</span>
            <span>Unit</span>
            <span>Zone</span>
          </div>
          {posted.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              No zones posted for this date.
            </p>
          ) : (
            <ul className="pb-4">
              {posted.map((row) => (
                <li
                  key={row.officer.id}
                  className="zone-cols grid items-center border-b border-border px-4 py-3.5"
                >
                  <span className="truncate text-sm font-medium tracking-wide">
                    {row.officer.name}
                  </span>
                  <span className="tabular text-sm text-muted">{row.officer.unit}</span>
                  <span className="text-sm font-medium">{row.zone}</span>
                </li>
              ))}
            </ul>
          )}
          {audience === "dispatch" && open.length > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <p className="text-2xs uppercase tracking-wide text-muted">Open</p>
              <p className="mt-1 text-sm">
                {open.map((z) => (zoneHint(z.id) && zoneHint(z.id) !== z.label ? `${z.id} ${zoneHint(z.id)}` : z.id)).join(" · ")}
              </p>
            </div>
          ) : null}
        </div>

        <footer className="border-t border-border bg-header pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 p-1">
            <button
              type="button"
              onClick={() => setAudience("shift")}
              className={cn(
                "h-10 rounded-sm text-2xs font-medium uppercase tracking-wide",
                audience === "shift" ? "bg-primary text-primary-foreground" : "text-muted",
              )}
            >
              Shift
            </button>
            <button
              type="button"
              onClick={() => setAudience("dispatch")}
              className={cn(
                "h-10 rounded-sm text-2xs font-medium uppercase tracking-wide",
                audience === "dispatch" ? "bg-primary text-primary-foreground" : "text-muted",
              )}
            >
              Dispatch
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 px-3 pt-1">
            <Button className="w-full" onClick={() => void sendPhoto()} disabled={Boolean(busy)}>
              <Image className="size-4" />
              {busy === "send" ? "Making…" : "Send photo"}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void downloadPhoto()}
              disabled={Boolean(busy)}
            >
              <Download className="size-4" />
              {busy === "download" ? "Saving…" : "Download"}
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1 px-2 pb-1 pt-1">
            <Button size="sm" variant="ghost" onClick={() => void shareList()}>
              <Share2 className="size-4" />
              List
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={smsHref(text)}>
                <MessageSquare className="size-4" />
                Text
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={mailtoHref(shareTitle, text)}>
                <Mail className="size-4" />
                Email
              </a>
            </Button>
          </div>
        </footer>
      </div>
    </Overlay>
  );
}
