import { cn } from "@/lib/cn";

export function SheriffMark({ className = "size-9" }: { className?: string }) {
  return (
    <img
      src="/watchboard-mark.png"
      alt=""
      className={cn("object-contain", className)}
    />
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <img
      src="/watchboard-wordmark.png"
      alt="WatchBoard"
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
