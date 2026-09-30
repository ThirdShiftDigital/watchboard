import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/staff";

export const Route = createFileRoute("/forgot")({ component: ForgotPage });

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Forgot password</p>
        </div>
        {message ? (
          <div className="rounded-lg border border-border bg-card px-5 py-6 text-center">
            <p className="font-display text-xl font-semibold uppercase tracking-wide">Request in</p>
            <p className="mt-3 text-sm text-muted">{message}</p>
            <p className="mt-2 text-xs text-subtle">Codes expire after 45 minutes.</p>
            <Button className="mt-6 w-full" asChild>
              <Link to="/reset" search={{ email }}>
                Set new password
              </Link>
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4 rounded-lg border border-border bg-card px-5 py-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const result = await requestPasswordReset({ data: { email: email.trim() } });
                setMessage(result.message);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not send reset");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted">
              Enter the email on your account. Your shift commander will see a reset code on
              Accounts and can give it to you.
            </p>
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
            <Button className="w-full" type="submit" disabled={busy || !email}>
              {busy ? "Sending…" : "Request reset"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Back to sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
