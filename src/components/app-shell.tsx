import { CalendarDays, ClipboardList, LayoutDashboard, List, Table2, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SupervisorGate } from "@/components/supervisor-gate";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/cn";
import { useMyAccess } from "@/lib/hooks";
import { BrandLockup, SheriffMark } from "./sheriff-mark";
import { ShiftSwitcher } from "./shift-switcher";

export function AppShell({
  title,
  actions,
  children,
  fab,
  pendingCount = 0,
  requireSupervisor = true,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  fab?: ReactNode;
  pendingCount?: number;
  requireSupervisor?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const access = useMyAccess();
  const caps = access.data?.caps;
  const nav = [
    { to: "/dashboard", label: "Command", icon: LayoutDashboard, show: Boolean(caps?.manageAgency || caps?.managePlatform) },
    { to: "/", label: "Zones", icon: List, show: caps?.viewBoard ?? false },
    { to: "/schedule", label: "Shift Schedule", icon: Table2, show: caps?.manageRoster ?? false },
    { to: "/requests", label: "Requests", icon: ClipboardList, show: caps?.approveRequests ?? false },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, show: caps?.viewCalendar ?? false },
    { to: "/account", label: caps?.manageAccounts ? "Accounts" : "Password", icon: Users, show: Boolean(caps) },
    { to: "/me", label: "Officer", icon: User, show: true },
  ].filter((item) => item.show);
  const cols = Math.min(Math.max(nav.length, 4), 6);

  const shell = (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-header md:flex">
        <div className="px-4 py-4">
          <BrandLockup />
          <div className="mt-3">
            <ShiftSwitcher />
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:bg-card-2 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                <span>{item.label}</span>
                {item.to === "/requests" && pendingCount > 0 ? (
                  <span
                    className={cn(
                      "ml-auto tabular rounded-full px-1.5 text-2xs font-semibold",
                      active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <UserButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-header px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <div className="md:hidden">
            <SheriffMark className="size-9" />
          </div>
          <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold uppercase tracking-wider">
            {title}
          </h1>
          <div className="flex items-center gap-0.5">
            {actions}
            <div className="md:hidden">
              <UserButton />
            </div>
          </div>
        </header>
        <div className="border-b border-border px-3 py-2 md:hidden">
          <ShiftSwitcher />
        </div>

        <main className="relative min-h-0 flex-1 pb-32 md:pb-6">{children}</main>

        {fab}

        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-header pb-[env(safe-area-inset-bottom)] md:hidden"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-0.5 py-2.5 text-center text-2xs tracking-wide",
                  active ? "bg-primary text-primary-foreground" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                <span className="w-full leading-tight">{item.label}</span>
                {item.to === "/requests" && pendingCount > 0 && !active ? (
                  <span className="absolute right-4 top-1.5 size-2 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );

  if (!requireSupervisor) return shell;
  return <SupervisorGate>{shell}</SupervisorGate>;
}

export function HeaderIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-card-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
