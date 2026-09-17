import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatLong } from "@/lib/dates";
import { HeaderIconButton } from "./app-shell";

export function DateBar({
  date,
  onChange,
  extra,
}: {
  date: string;
  onChange: (date: string) => void;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-card px-1">
      <HeaderIconButton label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft className="size-5" />
      </HeaderIconButton>
      <label className="relative flex min-w-0 flex-1 cursor-pointer flex-col items-center py-2">
        <span className="font-display text-lg font-semibold uppercase tracking-wide">
          {formatLong(date)}
        </span>
        {extra ? (
          <span className="text-2xs uppercase tracking-label text-muted">{extra}</span>
        ) : null}
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Choose date"
        />
      </label>
      <HeaderIconButton label="Next day" onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight className="size-5" />
      </HeaderIconButton>
    </div>
  );
}
