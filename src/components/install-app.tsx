import { Share, Smartphone, SquarePlus, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import {
  canNativeInstall,
  captureInstallPrompt,
  isIos,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "@/lib/pwa-install";

function useInstallReady() {
  return useSyncExternalStore(
    subscribeInstall,
    () => canNativeInstall(),
    () => false,
  );
}

export function InstallAppButton({ className }: { className?: string }) {
  const native = useInstallReady();
  const [iosOpen, setIosOpen] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    return captureInstallPrompt();
  }, []);

  if (standalone) return null;

  async function onInstall() {
    if (native) {
      const result = await promptInstall();
      if (result === "accepted") toast.success("WatchBoard is on your home screen");
      return;
    }
    if (isIos()) {
      setIosOpen(true);
      return;
    }
    toast.message("Use the browser menu → Install app / Add to Home Screen");
  }

  return (
    <>
      <Button type="button" variant="secondary" className={className} onClick={() => void onInstall()}>
        <Smartphone className="size-4" />
        Add to Home Screen
      </Button>
      {iosOpen ? <IosInstallSheet onClose={() => setIosOpen(false)} /> : null}
    </>
  );
}

function IosInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Overlay>
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-lg border-t border-border bg-header px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-semibold uppercase tracking-wide">
            Add WatchBoard
          </p>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-11 items-center justify-center">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-muted">iPhone only installs from Safari.</p>
        <ol className="mt-4 space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Share className="size-5 text-primary" />
            Tap the Share button
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus className="size-5 text-primary" />
            Tap Add to Home Screen
          </li>
          <li className="flex items-center gap-3">
            <Smartphone className="size-5 text-primary" />
            Open WatchBoard from the home screen
          </li>
        </ol>
        <Button className="mt-5 w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Overlay>
  );
}
