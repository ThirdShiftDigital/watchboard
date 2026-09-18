import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/sheriff-mark";

export function PublicDocShell({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">{kicker}</p>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">{title}</h1>
        </div>
        <div className="space-y-5 rounded-lg border border-border bg-card px-5 py-6 text-sm leading-relaxed text-muted">
          {children}
        </div>
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-center text-sm">
          <Link to="/home" className="text-primary underline-offset-4 hover:underline">
            Home
          </Link>
          <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms
          </Link>
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export function DocH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-base font-semibold uppercase tracking-wide text-foreground">
      {children}
    </h2>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function DocUl({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}
