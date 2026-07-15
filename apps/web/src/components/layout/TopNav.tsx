"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface TopNavProps {
  onMenuToggle?: () => void;
  showSearch?: boolean;
}

export function TopNav({ onMenuToggle, showSearch = true }: TopNavProps) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <header className="flex items-center justify-between px-lg py-md w-full sticky top-0 z-40 bg-white border-b border-outline-variant">
      <div className="flex items-center gap-lg flex-1">
        <button
          className="md:hidden p-sm text-on-surface-variant hover:text-primary transition-colors"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <Icon name="menu" size={24} />
        </button>

        {showSearch && (
          <form onSubmit={handleSearch} className="max-w-md w-full relative">
            <Icon
              name="search"
              size={20}
              className="absolute left-md top-1/2 -translate-y-1/2 text-outline pointer-events-none"
            />
            <input
              type="text"
              placeholder={t('common.searchPlaceholder')}
              className="w-full pl-xl pr-md py-sm bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary text-body-md font-body-md outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.parentElement?.classList.add("ring-2", "ring-primary");
              }}
              onBlur={(e) => {
                e.currentTarget.parentElement?.classList.remove("ring-2", "ring-primary");
              }}
            />
          </form>
        )}
      </div>

      <div className="flex items-center gap-md">
        <button className="p-sm text-on-surface-variant hover:text-primary transition-colors" title={t('nav.notifications')}>
          <Icon name="notifications" size={24} />
        </button>
        <button className="p-sm text-on-surface-variant hover:text-primary transition-colors" title={t('common.support')}>
          <Icon name="help" size={24} />
        </button>
      </div>
    </header>
  );
}
