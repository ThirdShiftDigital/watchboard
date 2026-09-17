import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordReset } from "@/lib/staff";

type ResetSearch = { email?: string };

export const Route = createFileRoute("/reset")({
  validateSearch: (s: Record<string, unknown>): ResetSearch => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  component: ResetPage,
});

function ResetPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(search.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Set new password</p>
        </div>
        <form
          className="space-y-4 rounded-lg border border-border bg-card px-5 py-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await completePasswordReset({
                data: { email: email.trim(), code: code.trim(), password },
              });
              toast.success("Password updated — sign in");
              await navigate({ to: "/login" });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not reset password");
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Reset code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted">
          <Link to="/forgot" className="text-primary underline-offset-4 hover:underline">
            Request a code
          </Link>
        </p>
      </div>
    </main>
  );
}
