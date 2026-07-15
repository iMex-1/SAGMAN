"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { Toaster } from "@/components/ui/toast";
import { authStorage } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = authStorage.getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const stored = authStorage.getUser();
    if (stored && "email" in stored) {
      setUser({ name: stored.name, email: stored.email, role: stored.role });
    }
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          userRole={user?.role ?? "manager"}
          userName={user?.name ?? "..."}
          userEmail={user?.email}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <Sidebar
            userRole={user?.role ?? "manager"}
            userName={user?.name ?? "..."}
            userEmail={user?.email}
          />
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 bg-surface">
        <TopNav onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 overflow-y-auto p-lg">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-col md:flex-row justify-between items-center px-lg py-md w-full mt-auto border-t border-outline-variant bg-surface-container-lowest">
          <div className="flex items-center gap-md">
            <p className="font-title-md text-title-md font-bold text-primary">Sagman Garage</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              &copy; 2026 Sagman Garage. {t('common.allRightsReserved')}
            </p>
          </div>
          <div className="flex gap-lg mt-md md:mt-0">
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:underline decoration-primary" href="#">
              {t('common.privacyPolicy')}
            </a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:underline decoration-primary" href="#">
              {t('common.termsOfService')}
            </a>
            <a className="font-label-sm text-label-sm text-on-surface-variant hover:underline decoration-primary" href="#">
              {t('common.support')}
            </a>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-outline-variant flex justify-around py-sm z-[100]">
        {[
          { href: "/dashboard", icon: "dashboard", key: "dashboard" },
          { href: "/repairs", icon: "build", key: "repairs" },
          { href: "/appointments", icon: "event", key: "appointments" },
          { href: "/calendar", icon: "calendar_month", key: "calendar" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-xs text-on-surface-variant"
          >
            <Icon name={item.icon} size={24} />
            <span className="text-[10px] font-medium">{t(`nav.${item.key}`)}</span>
          </a>
        ))}
      </nav>

      <Toaster />
    </div>
  );
}
