import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/sheriff-mark";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyAccess } from "@/lib/hooks";
import { joinAgency, peekInvite, startAgency } from "@/lib/agencies";

type OnboardSearch = { code?: string };

export const Route = createFileRoute("/onboard")({
  validateSearch: (s: Record<string, unknown>): OnboardSearch => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: OnboardPage,
});

function OnboardPage() {
  const { code: codeFromUrl } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const access = useMyAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState(codeFromUrl ?? "");
  const [agencyName, setAgencyName] = useState("");
  const [shortName, setShortName] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [commanderEmail, setCommanderEmail] = useState("");
  const [commanderPassword, setCommanderPassword] = useState("");

  const peek = useQuery({
    queryKey: ["invite", code.trim().toUpperCase()],
    queryFn: () => peekInvite({ data: { code: code.trim() } }),
    enabled: code.trim().length >= 4,
    retry: false,
  });

  const start = useMutation({
    mutationFn: () =>
      startAgency({
        data: {
          code: code.trim() || undefined,
          agencyName,
          shortName: shortName || undefined,
          commanderName,
          commanderEmail,
          commanderPassword,
        },
      }),
    onSuccess: async (res) => {
      if ("commander" in res && res.commander) {
        toast.success(`Agency saved. Division leader login: ${res.commander.email}`);
      } else {
        toast.success("Submitted — waiting for Command to verify setup");
      }
      await queryClient.invalidateQueries();
      navigate({ to: "/dashboard" });
    },
    onError: (err) => toast.error(err.message),
  });

  const join = useMutation({
    mutationFn: () => joinAgency({ data: { code: code.trim() } }),
    onSuccess: async () => {
      toast.success("You are on that agency");
      await queryClient.invalidateQueries();
      navigate({ to: "/" });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background">
        <p className="text-sm text-muted">Checking login…</p>
      </main>
    );
  }
  if (!user) {
    return <Navigate to="/login" search={{ code: codeFromUrl, next: "/onboard" }} />;
  }

  const canStartWithoutCode = Boolean(access.data?.caps.managePlatform);
  const kind = peek.data?.kind;
  const inviteOk = peek.isSuccess;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-8">
      <BrandLockup className="mx-auto w-full max-w-[18rem]" />
      <h1 className="mt-6 font-display text-2xl font-semibold uppercase tracking-wide">
        Onboard an agency
      </h1>
      <p className="mt-2 text-sm text-muted">
        Agency name and the division leader. Shifts are added later on Command.
      </p>

      <form
        className="mt-6 space-y-4 rounded-lg border border-border bg-card px-4 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (kind === "join") {
            join.mutate();
            return;
          }
          start.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="code">Invite code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7F2MQ"
            autoCapitalize="characters"
          />
          {peek.isError ? (
            <p className="text-xs text-destructive">
              {peek.error instanceof Error ? peek.error.message : "Invalid code"}
            </p>
          ) : null}
          {inviteOk && kind === "join" ? (
            <p className="text-xs text-primary">
              Join {peek.data.agencyName ?? "this agency"} as a supervisor.
            </p>
          ) : null}
          {inviteOk && kind === "agency" ? (
            <p className="text-xs text-primary">This code starts a new isolated agency.</p>
          ) : null}
        </div>

        {kind === "join" ? (
          <Button className="w-full" type="submit" disabled={join.isPending}>
            {join.isPending ? "Joining…" : "Join agency"}
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="agency">Agency name</Label>
              <Input
                id="agency"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Williamson County Sheriff’s Office"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Short name</Label>
              <Input
                id="short"
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="WCSO"
                maxLength={12}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dl-name">Division leader</Label>
              <Input
                id="dl-name"
                value={commanderName}
                onChange={(e) => setCommanderName(e.target.value)}
                placeholder="Capt. J. Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dl-email">Leader email</Label>
              <Input
                id="dl-email"
                type="email"
                value={commanderEmail}
                onChange={(e) => setCommanderEmail(e.target.value)}
                placeholder="captain@agency.gov"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dl-pass">Temporary password</Label>
              <Input
                id="dl-pass"
                type="password"
                value={commanderPassword}
                onChange={(e) => setCommanderPassword(e.target.value)}
                placeholder="8+ characters"
                minLength={8}
                required
              />
            </div>
            <Button
              className="h-12 w-full text-base"
              type="submit"
              disabled={
                start.isPending ||
                agencyName.trim().length < 2 ||
                commanderName.trim().length < 2 ||
                commanderPassword.length < 8 ||
                (!inviteOk && !canStartWithoutCode)
              }
            >
              {start.isPending ? "Saving…" : canStartWithoutCode ? "Save agency" : "Submit for verification"}
            </Button>
            {!inviteOk && !canStartWithoutCode ? (
              <p className="text-xs text-muted">
                Enter a commander invite code, or ask your shift commander to send one.
              </p>
            ) : null}
          </>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/account" className="text-primary underline-offset-4 hover:underline">
          Back to accounts
        </Link>
      </p>
    </main>
  );
}
