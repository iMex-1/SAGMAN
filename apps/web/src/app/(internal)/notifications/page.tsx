"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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

const TEMPLATE_LABELS: Record<string, string> = {
  "T-01": "Confirmation RDV",
  "T-02": "Report RDV",
  "T-03": "Diagnostic",
  "T-04": "Véhicule prêt",
  "T-05": "Facture",
  "T-06": "Rapport journalier",
};

const TEMPLATE_BADGE_COLORS: Record<string, string> = {
  "T-01": "bg-blue-100 text-blue-700 border-blue-200",
  "T-02": "bg-amber-100 text-amber-700 border-amber-200",
  "T-03": "bg-purple-100 text-purple-700 border-purple-200",
  "T-04": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "T-05": "bg-slate-100 text-slate-700 border-slate-200",
  "T-06": "bg-orange-100 text-orange-700 border-orange-200",
};

const TYPE_FILTERS = [
  "Tous",
  "T-01",
  "T-02",
  "T-03",
  "T-04",
  "T-05",
  "T-06",
] as const;

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("Tous");
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
      if (typeFilter !== "Tous") params.set("type", typeFilter);

      const res = await api.get<NotificationsResponse>(
        `/notifications?${params.toString()}`,
      );
      setNotifications(res.data);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Erreur lors du chargement des notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function handleTypeChange(type: string) {
    setTypeFilter(type);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Journal des notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique des messages WhatsApp envoyés
        </p>
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1">
        {TYPE_FILTERS.map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              typeFilter === type
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {type === "Tous" ? "Tous" : `${type} — ${TEMPLATE_LABELS[type]}`}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="ml-auto"
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">Aucune notification trouvée.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Destinataire
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Aperçu du message
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    Envoyé par
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notifications.map((notif) => (
                  <tr
                    key={notif.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(notif.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                          TEMPLATE_BADGE_COLORS[notif.type] ??
                            "bg-slate-100 text-slate-700 border-slate-200",
                        )}
                      >
                        {notif.type}
                        {TEMPLATE_LABELS[notif.type]
                          ? ` — ${TEMPLATE_LABELS[notif.type]}`
                          : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {notif.recipientPhone}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {truncate(notif.messagePreview, 60)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {notif.sentBy.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {notif.repair ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/repairs/${notif.repair.id}`}>
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Voir réparation</span>
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} notification{total !== 1 ? "s" : ""} · Page {page} /{" "}
              {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
