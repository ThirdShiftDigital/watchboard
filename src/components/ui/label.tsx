import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-2xs font-medium uppercase tracking-label text-muted",
        className,
      )}
      {...props}
    />
  );
}
