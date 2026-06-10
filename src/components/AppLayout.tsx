import { Link, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  ScrollText,
  Loader2,
  UserCog,
  FileBarChart,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/register-patient", label: "Register Patient", icon: UserPlus },
  { to: "/patients", label: "Patient Records", icon: Users },
  { to: "/triage", label: "Triage", icon: Stethoscope, nurseOrAdmin: true },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/staff", label: "Staff Management", icon: UserCog, adminOnly: true },
  { to: "/audit", label: "Audit Logs", icon: ScrollText, adminOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { user, loading, isAdmin, isSuperAdmin, isNurse, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const initials = (user.user_metadata?.full_name || user.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10">
            <ShieldCheck className="h-5 w-5 text-success" />
          </div>
          <div>
            <div className="text-base font-semibold leading-none">MediReg</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Patient Registry</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems
            .filter((n) => (!n.adminOnly || isAdmin) && (!n.nurseOrAdmin || isAdmin || isNurse))
            .map((n) => {
              const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-success/15 px-3 py-2 text-xs">
            <div className="font-medium text-success">{isSuperAdmin ? "Super Admin" : "License Active"}</div>
            <div className="text-sidebar-foreground/70">{isSuperAdmin ? "License exempt · full access" : "365 days remaining"}</div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <div className="font-medium text-foreground">{user.user_metadata?.full_name || user.email}</div>
              <div className="text-muted-foreground">{isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Staff"}</div>
            </div>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
