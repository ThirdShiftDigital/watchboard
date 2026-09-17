import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToPatchDataUrl } from "@/lib/rdo-pdf";
import { setAgencyPatch } from "@/lib/agencies";

export function PatchUploader({
  patchData,
  onSaved,
}: {
  patchData?: string | null;
  onSaved: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(patchData ?? "");
  const [busy, setBusy] = useState(false);

  async function save(dataUrl: string) {
    setBusy(true);
    try {
      await setAgencyPatch({ data: { dataUrl } });
      setPreview(dataUrl);
      await onSaved();
      toast.success(dataUrl ? "Patch saved" : "Patch removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save patch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card-2 p-1">
        {preview ? (
          <img src={preview} alt="Agency patch" className="size-full object-contain" />
        ) : (
          <span className="px-1 text-center text-2xs uppercase tracking-wide text-muted">
            No patch
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const dataUrl = await fileToPatchDataUrl(file);
              await save(dataUrl);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not read image");
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Saving…" : preview ? "Replace patch" : "Upload patch"}
        </Button>
        {preview ? (
          <button
            type="button"
            className="w-full text-2xs uppercase tracking-wide text-muted hover:text-destructive"
            disabled={busy}
            onClick={() => void save("")}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
