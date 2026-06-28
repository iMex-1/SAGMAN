"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  CalendarDays,
  Car,
  Package,
  Calendar,
  Users,
  FileText,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { authStorage } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    roles: ["manager", "overseer"],
  },
  {
    href: "/repairs",
    label: "Réparations",
    icon: Wrench,
    roles: ["manager", "mechanic"],
  },
  {
    href: "/appointments",
    label: "Rendez-vous",
    icon: CalendarDays,
    roles: ["manager"],
  },
  {
    href: "/cars",
    label: "Véhicules",
    icon: Car,
    roles: ["manager", "mechanic"],
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Package,
    roles: ["manager", "mechanic"],
  },
  {
    href: "/calendar",
    label: "Calendrier",
    icon: Calendar,
    roles: ["manager", "mechanic"],
  },
  { href: "/employees", label: "Employés", icon: Users, roles: ["manager"] },
  { href: "/reports", label: "Rapports", icon: FileText, roles: ["manager"] },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["manager"],
  },
  {
    href: "/settings",
    label: "Paramètres",
    icon: Settings,
    roles: ["manager"],
  },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground select-none">
      {initials}
    </div>
  );
}

export function Sidebar({
  userRole = "manager",
  userName = "User",
  userEmail = "",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );

  function handleLogout() {
    authStorage.clear();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar shadow-sidebar">
      {/* ── Logo header ──────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <Logo size="sm" />
        <div>
          <span className="block text-base font-bold tracking-wide text-white">
            SAGMAN
          </span>
          <span className="block text-[10px] uppercase tracking-widest text-sidebar-muted">
            Auto Repairs
          </span>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
          Menu
        </p>
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <li key={item.href} className="relative">
                {/* Active left-border accent */}
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-primary transition-opacity duration-150",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />

                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-muted group-hover:text-sidebar-foreground",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-sidebar-muted" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User footer ──────────────────────────────── */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <UserAvatar name={userName} />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {userName}
            </p>
            <p className="truncate text-xs text-sidebar-muted capitalize">
              {userRole}
            </p>
            {userEmail && (
              <p className="truncate text-xs text-sidebar-muted">{userEmail}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-destructive transition-colors"
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
