"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { authStorage } from "@/lib/auth";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = authStorage.getAccessToken();
    setIsAuthenticated(!!token);
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    authStorage.clear();
    router.push("/portal");
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top navigation bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Brand */}
          <Link href="/portal" className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" />
            <div className="leading-none">
              <span className="block text-sm sm:text-headline-lg font-black tracking-wide text-primary whitespace-nowrap">
                SAGMAN AUTO
              </span>
              <span className="block text-[9px] sm:text-xs uppercase tracking-widest text-on-surface-variant leading-none">
                Auto Service
              </span>
            </div>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                {/* Desktop nav */}
                <nav className="hidden md:flex items-center gap-1">
                  <Link
                    href="/portal/cars"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      pathname.startsWith("/portal/cars")
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:text-primary hover:bg-surface-container",
                    )}
                  >
                    <Icon name="directions_car" size={16} />
                    {t('portal.myCars.title')}
                  </Link>
                  <Link
                    href="/portal/book"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/portal/book"
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:text-primary hover:bg-surface-container",
                    )}
                  >
                    <Icon name="add_circle" size={16} />
                    {t('portal.booking.title')}
                  </Link>
                </nav>

                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1 rounded-md px-3 py-2 text-sm text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
                >
                  <Icon name="logout" size={16} />
                  {t('nav.logout')}
                </button>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden p-2 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                  aria-label={menuOpen ? `${t('common.close')} ${t('common.menu')}` : `${t('common.open')} ${t('common.menu')}`}
                >
                  {menuOpen ? (
                    <Icon name="close" size={20} />
                  ) : (
                    <Icon name="menu" size={20} />
                  )}
                </button>
              </>
            ) : (
              <Link
                href="/portal/login"
                className="bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md"
              >
                {t('portal.login.signIn')}
              </Link>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && isAuthenticated && (
          <div className="border-t border-outline-variant bg-white px-4 py-3 md:hidden space-y-1 shadow-sm">
            <Link
              href="/portal/cars"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/portal/cars")
                  ? "bg-primary-container text-on-primary-container"
                  : "text-primary hover:bg-surface-container",
              )}
            >
              <Icon name="directions_car" size={16} className="text-primary" />
              {t('portal.myCars.title')}
            </Link>
            <Link
              href="/portal/book"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/portal/book"
                  ? "bg-primary-container text-on-primary-container"
                  : "text-primary hover:bg-surface-container",
              )}
            >
              <Icon name="add_circle" size={16} className="text-primary" />
              {t('portal.booking.title')}
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-error hover:bg-error-container/20 transition-colors"
            >
              <Icon name="logout" size={16} />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="mx-auto w-full">{children}</main>

      {/* ── Mobile bottom nav (authenticated only) ───────────────────────── */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant bg-white md:hidden">
          <div className="flex">
            {[
              { href: "/portal/cars", icon: "directions_car", key: "cars" },
              { href: "/portal/book", icon: "add_circle", key: "book" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  pathname.startsWith(item.href)
                    ? "text-primary"
                    : "text-on-surface-variant",
                )}
              >
                <Icon name={item.icon} size={20} />
                {item.key === "cars" ? t('portal.myCars.title') : t('portal.booking.title')}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
