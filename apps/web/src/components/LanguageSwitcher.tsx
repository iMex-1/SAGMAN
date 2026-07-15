"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

interface LanguageSwitcherProps {
  variant?: "default" | "light";
}

export function LanguageSwitcher({
  variant = "default",
}: LanguageSwitcherProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]!;

  function switchLocale(code: string) {
    setOpen(false);
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60*60*24*365};sameSite=lax`;
      window.location.reload();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          variant === "light"
            ? "text-white/90 hover:bg-white/10"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          isPending && "opacity-50 cursor-wait",
        )}
        disabled={isPending}
        aria-label={t('common.language')}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.label.slice(0, 2)}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-50 mt-1 w-36 rounded-lg border bg-card shadow-lg overflow-hidden">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLocale(l.code)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent transition-colors",
                  l.code === locale && "bg-accent/60 font-semibold",
                )}
                dir={l.dir}
              >
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
