import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/sheriff-mark";
import { InstallAppButton } from "@/components/install-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMyAccess } from "@/lib/hooks";
import { claimShiftCommand, attachMyLogin } from "@/lib/staff";

type LoginSearch = { switch?: boolean; code?: string; next?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => {
    const raw = s.switch;
    return {
      switch:
        raw === true ||
        raw === 1 ||
        raw === "1" ||
        raw === "true" ||
        raw === "on",
      code: typeof s.code === "string" ? s.code : undefined,
      next: typeof s.next === "string" ? s.next : undefined,
    };
  },
  component: Login,
});

function Login() {
  const { switch: switchAccount, code, next } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const access = useMyAccess();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const formMode = mode;
  const canUseBoard = Boolean(access.data?.caps.viewBoard);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6">
        <p className="text-sm text-muted">Checking supervisor access…</p>
      </main>
    );
  }
  if (user && code) return <Navigate to="/onboard" search={{ code }} />;
  if (user && next === "/onboard") return <Navigate to="/onboard" />;
  if (user && canUseBoard && !switchAccount) return <Navigate to="/" />;
  if (user && access.data && !canUseBoard && !switchAccount) return <Navigate to="/me" />;

  async function submit() {
    if (!authEnabled) return;
    setBusy(true);
    try {
      const emailValue = email.trim().toLowerCase();
      if (user) {
        await attachMyLogin({
          data: { email: emailValue, password, name: name.trim() || undefined },
        });
      } else if (formMode === "up") {
        const { error } = await authClient.signUp.email({
          name: name.trim() || emailValue,
          email: emailValue,
          password,
        });
        if (error) throw new Error(error.message ?? "Could not create account");
      } else {
        const { error } = await authClient.signIn.email({
          email: emailValue,
          password,
        });
        if (error) {
          const created = await authClient.signUp.email({
            name: name.trim() || emailValue,
            email: emailValue,
            password,
          });
          if (created.error) {
            throw new Error(error.message ?? "Could not sign in");
          }
        }
      }
      await authClient.getSession();
      if (code) {
        window.location.href = `/onboard?code=${encodeURIComponent(code)}`;
        return;
      }
      if (next === "/onboard") {
        window.location.href = "/onboard";
        return;
      }
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Supervisor sign-in</p>
        </div>

        {user ? (
          <div className="space-y-3 rounded-lg border border-border bg-card px-5 py-4 text-center">
            <p className="text-sm text-muted">
              Signed in as {user.displayName ?? user.primaryEmail}
              {canUseBoard ? "" : ", officer access only"}.
            </p>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await claimShiftCommand();
                  window.location.href = "/";
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not take command");
                  setBusy(false);
                }
              }}
            >
              Make me shift commander
            </Button>
          </div>
        ) : null}

        {user && !canUseBoard ? (
          <p className="text-center text-sm text-muted">
            Or sign in with a supervisor email below.
          </p>
        ) : null}

        {!authEnabled ? (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        ) : (
          <form
            className="space-y-4 rounded-lg border border-border bg-card px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {formMode === "up" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="LT. C. KEYES"
                  autoComplete="name"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sheriff.gov"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={formMode === "up" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={busy}>
              {busy
                ? "Working…"
                : user
                  ? "Save login and continue"
                  : formMode === "up"
                    ? "Create login"
                    : "Sign in"}
            </Button>
            {formMode === "in" ? (
              <Link
                to="/forgot"
                className="block w-full pt-1 text-center text-xs text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            ) : null}
            <button
              type="button"
              className="w-full pt-1 text-center text-xs text-muted"
              onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
            >
              {formMode === "in"
                ? "Need an account? Create an officer login"
                : "Already have an account? Sign in"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted">
          Officer requesting days off?{" "}
          <Link to="/me" className="text-primary underline-offset-4 hover:underline">
            Open officer view
          </Link>
        </p>
        <p className="text-center text-sm text-muted">
          Onboarding another agency?{" "}
          <Link to="/onboard" className="text-primary underline-offset-4 hover:underline">
            Enter an invite
          </Link>
        </p>
        <InstallAppButton className="w-full" />
      </div>
    </main>
  );
}
