import { Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";

/** Public product homepage — used at `/` (signed-out) and `/home`. */
export function PublicHomePage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <header className="space-y-4 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Third Shift Digital</p>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
            Shift management for the watch
          </h1>
          <p className="text-sm text-muted">
            Zone assignments, sendable watch lists, days-off requests, and the leave calendar —
            built for law-enforcement and public-safety supervisors.
          </p>
          <div className="space-y-2 pt-1">
            <Button className="w-full" asChild>
              <Link to="/login">Sign in to WatchBoard</Link>
            </Button>
            <p className="text-xs text-muted">Authorized agency use only</p>
          </div>
        </header>

        <section className="space-y-3" aria-label="What WatchBoard does">
          <article className="space-y-1 rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              Watch board
            </h2>
            <p className="text-sm text-muted">
              Run zone assignments and send the watch list for the shift in one place.
            </p>
          </article>
          <article className="space-y-1 rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              Days off
            </h2>
            <p className="text-sm text-muted">
              Officers request leave; supervisors approve or manage call-ins without the group-chat
              scramble.
            </p>
          </article>
          <article className="space-y-1 rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              Leave calendar
            </h2>
            <p className="text-sm text-muted">
              See who’s out on the in-app calendar for the watch — visible to the people who need it.
            </p>
          </article>
          <article className="space-y-1 rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
              Google Calendar
            </h2>
            <p className="text-sm text-muted">
              Optional. Connect a Google account to pull leave into WatchBoard and write approved days
              off back.
            </p>
          </article>
        </section>

        <p className="rounded-lg border border-border bg-card-2 px-4 py-3 text-sm text-muted">
          WatchBoard is a Third Shift Digital LLC product for authorized agencies. It is not consumer
          social software and not a replacement for CAD, RMS, or official agency policy systems.
        </p>

        <footer className="space-y-2 text-center text-sm">
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Use
            </Link>
          </p>
          <p className="text-xs text-muted">Third Shift Digital LLC · info@totalcircumstance.com</p>
        </footer>
      </div>
    </main>
  );
}
