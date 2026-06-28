"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { authStorage } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Car, PlusCircle, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-background">
      {/* ── Top navigation bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          {/* Brand */}
          <Link href="/portal" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <div className="leading-none">
              <span className="block text-sm font-black tracking-wide text-foreground">
                SAGMAN
              </span>
              <span className="block text-[9px] uppercase tracking-widest text-muted-foreground">
                Auto Repairs
              </span>
            </div>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
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
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <Car className="h-4 w-4" />
                    Mes véhicules
                  </Link>
                  <Link
                    href="/portal/book"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/portal/book"
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Rendez-vous
                  </Link>
                </nav>

                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
                >
                  {menuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              </>
            ) : (
              <Link
                href="/portal/login"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && isAuthenticated && (
          <div className="border-t bg-white px-4 py-3 md:hidden space-y-1 shadow-sm">
            <Link
              href="/portal/cars"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/portal/cars")
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              <Car className="h-4 w-4 text-primary" />
              Mes véhicules
            </Link>
            <Link
              href="/portal/book"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/portal/book"
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              <PlusCircle className="h-4 w-4 text-primary" />
              Prendre rendez-vous
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>

      {/* ── Mobile bottom nav (authenticated only) ───────────────────────── */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
          <div className="flex">
            {[
              { href: "/portal/cars", icon: Car, label: "Véhicules" },
              { href: "/portal/book", icon: PlusCircle, label: "Rendez-vous" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  pathname.startsWith(item.href)
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
