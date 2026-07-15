"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useTranslations } from "next-intl";

interface Notification {
  id: string;
  type: string;
  recipientPhone: string;
  messagePreview: string;
  sentAt: string;
  sentBy: { name: string };
  repair?: { id: string };
}

interface NotificationsResponse {
  data: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const LIMIT = 20;

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export default function NotificationsPage() {
  const t = useTranslations();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });

      const res = await api.get<NotificationsResponse>(
        `/notifications?${params.toString()}`,
      );
      setNotifications(res.data);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('notifications.errors.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('notifications.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('notifications.subtitle')}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="ml-auto"
          >
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('common.noResults')}</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                    {t('common.date')}
                  </th>
                  <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                    {t('notifications.type')}
                  </th>
                  <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                    {t('notifications.recipient')}
                  </th>
                  <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">
                    {t('notifications.messagePreview')}
                  </th>
                  <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">
                    {t('notifications.sentBy')}
                  </th>
                  <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif) => (
                  <tr
                    key={notif.id}
                    className="hover:bg-surface-container-low"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant font-body-md text-body-md">
                      {formatDateTime(notif.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm font-bold border bg-surface-container-low text-on-surface-variant border-outline-variant">
                        {notif.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-title-md text-title-md">
                      {notif.recipientPhone}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden md:table-cell">
                      {truncate(notif.messagePreview, 60)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden lg:table-cell">
                      {notif.sentBy.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {notif.repair ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/repairs/${notif.repair.id}`}>
                            <Icon name="open_in_new" size={16} />
                            <span className="sr-only">{t('notifications.viewRepair')}</span>
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-on-surface-variant/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('notifications.pagination').replace('{total}', String(total)).replace('{page}', String(page)).replace('{totalPages}', String(totalPages))}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <Icon name="chevron_left" size={16} />
                {t('common.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                {t('common.next')}
                <Icon name="chevron_right" size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
