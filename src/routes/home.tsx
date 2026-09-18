import { Link, createFileRoute } from "@tanstack/react-router";
import { BrandLockup } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "WatchBoard — Shift management for public safety" },
      {
        name: "description",
        content:
          "Zone assignments, sendable watch lists, days-off requests, and the leave calendar for the shift.",
      },
    ],
  }),
});

function HomePage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Third Shift Digital</p>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">WatchBoard</h1>
          <p className="text-sm text-muted">
            Zone assignments, sendable watch lists, days-off requests, and the leave calendar for the
            shift.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card px-5 py-5 text-sm leading-relaxed text-muted">
          <p>
            WatchBoard is a shift tool from Third Shift Digital LLC, built for law-enforcement and
            public-safety agencies. Supervisors run the watch board; officers request days off; the
            leave calendar stays visible to the people who need it.
          </p>
          <div className="space-y-2">
            <p className="font-display text-base font-semibold uppercase tracking-wide text-foreground">
              What it does
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-foreground">Watch board</span> — zone assignments and sendable
                watch lists for the shift
              </li>
              <li>
                <span className="text-foreground">Days off</span> — officers request leave;
                supervisors approve or manage call-ins
              </li>
              <li>
                <span className="text-foreground">Leave calendar</span> — see leave on the in-app
                calendar for the watch
              </li>
              <li>
                <span className="text-foreground">Google Calendar (optional)</span> — connect a Google
                account so WatchBoard can pull leave events into the in-app calendar and write approved
                days off back to that calendar
              </li>
            </ul>
          </div>
          <p>
            WatchBoard is for authorized agency use. It is not consumer social software and not a
            replacement for CAD, RMS, or official agency policy systems.
          </p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" asChild>
            <Link to="/login">Sign in to WatchBoard</Link>
          </Button>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-center text-sm">
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Use
            </Link>
          </p>
          <p className="text-center text-xs text-muted">
            Third Shift Digital LLC · info@totalcircumstance.com
          </p>
        </div>
      </div>
    </main>
  );
}
