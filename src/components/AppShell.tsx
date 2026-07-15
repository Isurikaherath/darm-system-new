import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Boxes,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Users,
  UserCircle,
  CheckSquare,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROLE_LABELS, type AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof FileText;
  roles?: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/carts", label: "Carts", icon: Boxes },
  { to: "/approvals", label: "Approvals", icon: CheckSquare, roles: ["super_admin", "office_services", "dept_head"] },
  { to: "/retrievals", label: "Retrievals", icon: RefreshCw },
  { to: "/disposal", label: "Disposal Alerts", icon: AlertTriangle },
  { to: "/costs", label: "Cost Management", icon: DollarSign, roles: ["super_admin", "office_services", "dept_head"] },
  { to: "/profile", label: "My Profile", icon: UserCircle },
  { to: "/admin", label: "Admin", icon: Users, roles: ["super_admin"] },
];

// Parse hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function isLightHex(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return relLuminance(rgb) > 0.5;
}

function mix(hex: string, withHex: string, ratio: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  if (!a || !b) return hex;
  const r = Math.round(a.r * (1 - ratio) + b.r * ratio);
  const g = Math.round(a.g * (1 - ratio) + b.g * ratio);
  const bl = Math.round(a.b * (1 - ratio) + b.b * ratio);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function buildThemeVars(color: string): Record<string, string> {
  const light = isLightHex(color);
  const fg = light ? "#0b1220" : "#f8fafc";
  const mutedFg = light ? "#334155" : "#cbd5e1";
  const card = light ? mix(color, "#ffffff", 0.55) : mix(color, "#000000", 0.35);
  const muted = light ? mix(color, "#ffffff", 0.7) : mix(color, "#000000", 0.2);
  const border = light ? mix(color, "#000000", 0.15) : mix(color, "#ffffff", 0.2);
  const sidebar = light ? mix(color, "#ffffff", 0.35) : mix(color, "#000000", 0.25);
  const accent = light ? mix(color, "#000000", 0.1) : mix(color, "#ffffff", 0.15);
  return {
    "--background": color,
    "--foreground": fg,
    "--card": card,
    "--card-foreground": fg,
    "--popover": card,
    "--popover-foreground": fg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--accent": accent,
    "--accent-foreground": fg,
    "--border": border,
    "--input": border,
    "--sidebar": sidebar,
    "--sidebar-foreground": fg,
    "--sidebar-border": border,
    "--sidebar-accent": accent,
    "--sidebar-accent-foreground": fg,
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const deptQ = useQuery({
    queryKey: ["dept-info", user?.profile.department_id],
    enabled: !!user?.profile.department_id,
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("name, theme_color").eq("id", user!.profile.department_id!).maybeSingle();
      return data as { name: string | null; theme_color: string | null } | null;
    },
  });
  const themeColor = deptQ.data?.theme_color ?? null;
  const isOfficeServicesDept = (deptQ.data?.name ?? "").trim().toLowerCase() === "office services";

  const themeVars = useMemo(
    () => (themeColor ? buildThemeVars(themeColor) : {}),
    [themeColor],
  );

  useEffect(() => {
    if (themeColor && typeof document !== "undefined") {
      document.body.style.backgroundColor = themeColor;
    }
    return () => {
      if (typeof document !== "undefined") document.body.style.backgroundColor = "";
    };
  }, [themeColor]);

  const items = NAV.filter((n) => {
    if (!n.roles) return true;
    if (!user) return false;
    if (n.roles.some((r) => user.roles.includes(r))) return true;
    // Office Services department employees also get Cost Management access
    if (n.to === "/costs" && isOfficeServicesDept) return true;
    return false;
  });


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const light = themeColor ? isLightHex(themeColor) : true;
  const sidebarActiveClass = light
    ? "bg-slate-900 text-white"
    : "bg-white text-slate-900";
  const sidebarIdleClass = light
    ? "text-slate-700 hover:bg-black/5"
    : "text-slate-100 hover:bg-white/10";

  return (
    <div
      className={cn("min-h-screen flex w-full bg-background text-foreground")}
      style={themeVars as React.CSSProperties}
    >
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-xl font-bold">DARMS</div>
          <div className="text-xs opacity-70 mt-0.5">Document Archive & Retrieval Management System</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? (themeColor ? sidebarActiveClass : "bg-slate-900 text-white")
                    : (themeColor ? sidebarIdleClass : "text-slate-700 hover:bg-slate-100"),
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          {user && (
            <div className="mb-3">
              <div className="text-sm font-medium truncate">
                {user.profile.full_name ?? user.email}
              </div>
              <div className="text-xs opacity-70">{ROLE_LABELS[user.primaryRole]}</div>
              {!user.profile.is_active && (
                <div className="text-xs text-amber-500 mt-1">Pending activation</div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

