import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "rdo";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-1.5 py-0.5 text-2xs font-medium tracking-wide uppercase",
        tone === "neutral" && "bg-card-2 text-muted border border-border",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "rdo" && "bg-rdo text-rdo-fg",
        className,
      )}
      {...props}
    />
  );
}
