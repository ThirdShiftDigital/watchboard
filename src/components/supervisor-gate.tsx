import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMyAccess } from "@/lib/hooks";

export function SupervisorGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const access = useMyAccess();
  if (isPending || (user && access.isPending)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted">Checking supervisor access…</p>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (access.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        <p className="text-sm text-muted">Could not check supervisor access.</p>
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => void access.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }
  if (access.data && !access.data.caps.viewBoard) return <Navigate to="/me" />;
  return <>{children}</>;
}
