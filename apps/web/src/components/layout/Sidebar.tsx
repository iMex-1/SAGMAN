"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { authStorage } from "@/lib/auth";

interface NavItem {
  href: string;
  key: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: "dashboard", roles: ["manager", "overseer"] },
  { href: "/repairs", key: "repairs", icon: "build", roles: ["manager", "mechanic"] },
  { href: "/appointments", key: "appointments", icon: "event", roles: ["manager"] },
  { href: "/cars", key: "cars", icon: "directions_car", roles: ["manager", "mechanic"] },
  { href: "/stock", key: "stock", icon: "inventory_2", roles: ["manager", "mechanic"] },
  { href: "/calendar", key: "calendar", icon: "calendar_month", roles: ["manager", "mechanic"] },
  { href: "/employees", key: "employees", icon: "badge", roles: ["manager"] },
  { href: "/reports", key: "reports", icon: "bar_chart", roles: ["manager"] },
  { href: "/notifications", key: "notifications", icon: "notifications", roles: ["manager"] },
  { href: "/settings", key: "settings", icon: "settings", roles: ["manager"] },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export function Sidebar({ userRole = "manager", userName = "User", userEmail = "" }: SidebarProps) {
  const t = useTranslations();
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
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r rtl:border-l border-outline-variant bg-surface py-lg z-50">
      <div className="px-lg mb-xl">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <div>
            <h1 className="font-title-md text-title-md font-black text-primary leading-none">SAGMAN AUTO</h1>
            <p className="text-label-sm font-label-sm text-on-surface-variant leading-none mt-0.5">Auto Service</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-xs px-sm overflow-y-auto scrollbar-hide">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const IconComponent = Icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-md px-md py-sm rounded-lg text-body-md font-body-md transition-colors",
                isActive
                  ? "text-primary font-bold border-r-4 rtl:border-l-4 border-primary bg-primary-container/10"
                  : "text-on-surface-variant font-medium hover:bg-surface-container-high",
              )}
            >
              <IconComponent
                name={item.icon}
                size={20}
                className={cn(isActive ? "text-primary" : "text-on-surface-variant")}
              />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline-variant px-md py-md">
        <LanguageSwitcher variant="default" />
      </div>

      <div className="border-t border-outline-variant px-md pt-md">
        <div className="flex items-center gap-md">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary select-none">
            {userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body-md text-body-md font-bold text-on-surface truncate">{userName}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant capitalize truncate">
              {t(`employee.roles.${userRole}`)}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-sm text-on-surface-variant hover:text-secondary transition-colors rounded-md hover:bg-surface-container-high"
            title={t('nav.logout')}
          >
            <Icon name="logout" size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}
