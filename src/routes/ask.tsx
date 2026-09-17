import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RequestForm } from "@/components/request-form";
import { SheriffMark } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { createRequest, getOfficerPortal } from "@/lib/fns";
import { isValidISODate } from "@/lib/dates";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMyAccess } from "@/lib/hooks";

type AskSearch = {
  start?: string;
  end?: string;
};

export const Route = createFileRoute("/ask")({
  validateSearch: (s: Record<string, unknown>): AskSearch => ({
    start: typeof s.start === "string" && isValidISODate(s.start) ? s.start : undefined,
    end: typeof s.end === "string" && isValidISODate(s.end) ? s.end : undefined,
  }),
  component: AskPage,
});

function AskPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [done, setDone] = useState(false);
  const { user, isPending } = useCurrentUserState();
  const access = useMyAccess();

  const q = useQuery({
    queryKey: ["officer-portal", access.data?.officerId],
    queryFn: () => getOfficerPortal({ data: { officerId: access.data?.officerId ?? undefined } }),
    enabled: Boolean(user) && !access.isPending,
  });

  const officers = q.data?.officers ?? [];
  const lockedId = access.data?.officerId ?? q.data?.officer?.id;

  if (isPending || (user && access.isPending)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
        Checking officer access…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-header px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <SheriffMark className="size-9" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wider leading-none">
            Days Off
          </h1>
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted">Officer request</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/me">My watch</Link>
        </Button>
      </header>
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {done ? (
          <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
            <p className="font-display text-2xl font-semibold uppercase tracking-wide">
              Request in
            </p>
            <p className="mt-3 text-sm text-muted">
              A supervisor will approve it. Once they do, those dates fill the calendar
              and you are off the zone list.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => setDone(false)}>Submit another</Button>
              <Button variant="secondary" asChild>
                <Link to="/me">Back to my watch</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              Pick your name and dates. Nothing hits the calendar until a supervisor
              approves it.
            </p>
            {q.isLoading ? (
              <p className="text-sm text-muted">Loading roster…</p>
            ) : (
              <RequestForm
                embedded
                officers={officers}
                lockedOfficerId={lockedId}
                initialStart={search.start}
                initialEnd={search.end ?? search.start}
                onSubmit={async (payload) => {
                  await createRequest({ data: payload });
                  await queryClient.invalidateQueries({ queryKey: ["officer-portal"] });
                  setDone(true);
                  toast.success("Request submitted");
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
