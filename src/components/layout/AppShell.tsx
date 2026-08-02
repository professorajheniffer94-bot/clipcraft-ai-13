import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Film,
  Palette,
  CreditCard,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME } from "@/constants/app";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/library", label: "Library", icon: Film },
  { to: "/brand", label: "Brand kit", icon: Palette },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-6 lg:px-8">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col justify-between rounded-3xl border border-border bg-surface p-4 lg:flex">
          <div>
            <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </span>
              <span className="font-display text-base font-semibold tracking-tight">{APP_NAME}</span>
            </Link>
            <nav className="mt-4 space-y-1">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-3">
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Signed in"}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="mt-2 w-full justify-start gap-2 text-muted-foreground"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface/95 px-2 py-2 backdrop-blur lg:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}