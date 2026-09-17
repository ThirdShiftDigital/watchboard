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
  const [code, setCode] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <BrandLockup className="mx-auto w-full max-w-[20rem]" />
          <p className="text-2xs uppercase tracking-wide text-muted">Forgot password</p>
        </div>
        {sent ? (
          <div className="rounded-lg border border-border bg-card px-5 py-6 text-center">
            <p className="font-display text-xl font-semibold uppercase tracking-wide">
              {code ? "Your reset code" : "Request in"}
            </p>
            {code ? (
              <>
                <p className="mt-4 font-display text-4xl font-semibold tracking-[0.25em]">{code}</p>
                <p className="mt-3 text-sm text-muted">
                  Use this code in the next two hours to set a new supervisor password.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                If that email has an account, a shift admin can also read the code on Accounts.
              </p>
            )}
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
                setCode(result.code ?? null);
                setSent(true);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not send reset");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted">
              Enter the email on your supervisor account. WatchBoard shows the
              reset code here so you can get back in without email.
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
              {busy ? "Sending…" : "Get reset code"}
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
