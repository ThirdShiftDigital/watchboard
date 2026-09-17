import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirectToLoginIfRequired } from "@/lib/app-data";

export function CalendarFeedPanel({
  url,
  google,
  canConnect,
  onSave,
  onConnect,
  onDisconnect,
  onClose,
}: {
  url: string;
  google: boolean;
  canConnect: boolean;
  onSave: (url: string) => Promise<void>;
  onConnect: () => Promise<{
    connected: boolean;
    pending?: boolean;
    loginRequired?: boolean;
    loginUrl?: string;
    message?: string;
  }>;
  onDisconnect: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(url);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  return (
    <form
      className="space-y-5 border-b border-border bg-card px-4 py-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(draft.trim());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save feed");
          setSaving(false);
        }
      }}
    >
      <p className="font-display text-lg font-semibold uppercase tracking-wide">
        Leave calendar
      </p>

      {canConnect ? (
        <div className="space-y-3 rounded-lg border border-border bg-card-2 px-3 py-3">
          <p className="text-2xs uppercase tracking-wide text-muted">Google Calendar</p>
          <p className="text-sm text-muted">
            {google
              ? "Connected. Approved days off are written here, and leave events pull into the watch."
              : "Shift commanders connect Google Calendar to read leave and write approved days off. Calendar-only access."}
          </p>
          {google ? (
            <Button
              type="button"
              variant="secondary"
              disabled={connecting}
              onClick={async () => {
                setConnecting(true);
                try {
                  await onDisconnect();
                  toast.success("Google Calendar disconnected from this shift");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not disconnect");
                } finally {
                  setConnecting(false);
                }
              }}
            >
              {connecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={connecting}
              onClick={async () => {
                setConnecting(true);
                try {
                  const result = await onConnect();
                  if (result.connected) {
                    toast.success("Google Calendar connected");
                    return;
                  }
                  if (result.loginRequired && result.loginUrl) {
                    redirectToLoginIfRequired({
                      ok: false,
                      data: null,
                      loginRequired: true,
                      loginUrl: result.loginUrl,
                    });
                    return;
                  }
                  toast.error(result.message ?? "Could not connect Google Calendar");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not connect");
                } finally {
                  setConnecting(false);
                }
              }}
            >
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </Button>
          )}
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Optional backup: a secret iCal address so the whole shift can see the same leave
        even when Google is not open.
      </p>
      <div className="space-y-2">
        <Label htmlFor="feed">Secret iCal URL</Label>
        <Input
          id="feed"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : url ? "Save feed" : "Link feed"}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave("");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not remove feed");
                setSaving(false);
              }
            }}
          >
            Remove feed
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}