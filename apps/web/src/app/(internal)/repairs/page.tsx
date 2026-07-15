"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Repair {
  id: string;
  status: string;
  priority: string;
  description: string;
  isOverdue: boolean;
  targetCompletionDate?: string;
  actualCompletionDate?: string;
  createdAt: string;
  car: { id: string; matricule: string; make: string; model: string };
  primaryMechanic: { id: string; name: string };
  _count?: { delayReports: number };
}

interface RepairsResponse {
  data: Repair[];
  meta: { total: number; page: number; limit: number };
}

type StatusTab = "all" | "active" | "overdue" | "delivered" | "cancelled";
type PriorityFilter = "all" | "emergency" | "high" | "normal" | "low";

const ACTIVE_STATUSES = "received,diagnosing,awaiting_approval,in_progress,waiting_for_parts,complete";

const PRIORITY_BG: Record<string, string> = {
  emergency: "bg-secondary-container/10 text-secondary",
  high: "bg-secondary-container/10 text-secondary",
  normal: "bg-primary-container/10 text-primary",
  low: "bg-surface-container-highest text-on-surface-variant",
};

const STATUS_BG: Record<string, string> = {
  overdue: "text-secondary font-semibold",
  delivered: "text-on-surface-variant font-medium",
  cancelled: "text-on-surface-variant font-medium line-through",
};

const STATUS_COLORS: Record<string, string> = {
  received: "bg-outline-variant",
  diagnosing: "bg-primary-fixed-dim",
  awaiting_approval: "bg-amber-400",
  in_progress: "bg-primary",
  waiting_for_parts: "bg-secondary",
  complete: "bg-green-500",
  delivered: "bg-outline-variant",
  cancelled: "bg-outline-variant",
};

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RepairsPage() {
  const t = useTranslations();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [mechanicFilter, setMechanicFilter] = useState("all");

  const STATUS_TABS: { label: string; value: StatusTab }[] = [
    { label: t('common.all'), value: "all" },
    { label: t('repair.filters.active'), value: "active" },
    { label: t('repair.filters.overdue'), value: "overdue" },
    { label: t('repair.filters.delivered'), value: "delivered" },
    { label: t('repair.filters.cancelled'), value: "cancelled" },
  ];

  const PRIORITY_LABELS: Record<string, string> = {
    emergency: t('repair.priority.emergency'),
    high: t('repair.priority.high'),
    normal: t('repair.priority.normal'),
    low: t('repair.priority.low'),
  };

  const loadRepairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusTab === "active") params.set("status", ACTIVE_STATUSES);
      else if (statusTab === "overdue") params.set("isOverdue", "true");
      else if (statusTab === "delivered") params.set("status", "delivered");
      else if (statusTab === "cancelled") params.set("status", "cancelled");
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      params.set("page", "1");
      params.set("limit", "50");
      const res = await api.get<RepairsResponse>(`/repairs?${params.toString()}`);
      setRepairs(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [statusTab, priorityFilter]);

  useEffect(() => { loadRepairs(); }, [loadRepairs]);

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
<h2 className="font-headline-xl text-headline-xl text-primary">{t('repair.title')}</h2>
           <p className="font-body-lg text-body-lg text-on-surface-variant">{t('repair.subtitle')}</p>
        </div>
        <div className="flex gap-sm">
          <div className="bg-white border border-outline-variant rounded-xl p-md flex items-center gap-md min-w-[160px]">
            <div className="bg-primary/10 text-primary p-sm rounded-full">
              <Icon name="pending_actions" size={24} />
            </div>
            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant">{t('repair.activeJobs')}</p>
              <p className="text-title-md font-title-md text-primary">{repairs.length}</p>
            </div>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-md flex items-center gap-md min-w-[160px]">
            <div className="bg-secondary/10 text-secondary p-sm rounded-full">
              <Icon name="error" size={24} filled />
            </div>
            <div>
<p className="text-label-sm font-label-sm text-on-surface-variant">{t('repair.overdue')}</p>
               <p className="text-title-md font-title-md text-secondary">
                {repairs.filter((r) => r.isOverdue).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-md flex flex-wrap items-center justify-between gap-md border-b border-outline-variant">
          <div className="flex bg-surface-container rounded-lg p-xs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={cn(
                  "px-md py-xs rounded-md font-label-sm text-label-sm transition-colors",
                  statusTab === tab.value
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-primary",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-sm">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="bg-surface border border-outline-variant rounded-lg font-body-md text-body-md px-sm py-xs outline-none focus:ring-2 focus:ring-primary"
            >
<option value="all">{t('repair.filters.allPriorities')}</option>
               <option value="emergency">{t('repair.priority.emergency')}</option>
               <option value="high">{t('repair.priority.high')}</option>
               <option value="normal">{t('repair.priority.normal')}</option>
               <option value="low">{t('repair.priority.low')}</option>
            </select>
            <select
              value={mechanicFilter}
              onChange={(e) => setMechanicFilter(e.target.value)}
              className="bg-surface border border-outline-variant rounded-lg font-body-md text-body-md px-sm py-xs outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{t('repair.filters.allMechanics')}</option>
            </select>
            <button className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant px-md py-xs border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">
              <Icon name="calendar_today" size={18} />
              {t('repair.filters.period')}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Icon name="sync" size={36} className="text-on-surface-variant animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-lg border-b border-outline-variant text-error">
            <Icon name="error" size={20} filled />
            <p className="text-sm flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={loadRepairs}>{t('common.retry')}</Button>
          </div>
        ) : repairs.length === 0 ? (
          <div className="p-xl text-center">
            <Icon name="build" size={48} className="text-outline-variant mx-auto mb-md" />
            <p className="text-on-surface-variant">{t('common.noResults')}</p>
            <Link href="/repairs/new" className="inline-block mt-md px-lg py-sm bg-primary text-on-primary rounded-lg font-title-md text-title-md">
              {t('repair.newRepair')}
            </Link>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('repair.fields.car')}</th>
                    <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('common.name')}</th>
<th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('repair.fields.mechanic')}</th>
                     <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('repair.fields.startDate')}</th>
<th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('repair.fields.priority')}</th>
                     <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('common.status')}</th>
                     <th className="px-lg py-md text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {repairs.map((repair) => {
                    const isOverdue = repair.isOverdue;
                    const priority = repair.priority || "normal";
                    return (
                      <tr key={repair.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-md">
                            <div className={cn("w-2 h-10 rounded-full shrink-0", STATUS_COLORS[repair.status] ?? "bg-outline-variant")} />
                            <div>
                              <p className="font-title-md text-title-md text-on-surface">{repair.car.matricule}</p>
                              <p className="font-body-md text-body-md text-on-surface-variant">{repair.car.make} {repair.car.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <p className="font-body-lg text-body-lg text-on-surface">—</p>
                        </td>
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-xs">
                            <Icon name="engineering" size={20} className="text-primary" />
                            <p className="font-body-md text-body-md text-on-surface">{repair.primaryMechanic?.name ?? t('repair.unassigned')}</p>
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <p className="font-body-md text-body-md text-on-surface">{formatDate(repair.createdAt)}</p>
                        </td>
                        <td className="px-lg py-md">
                          <span className={cn("inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm font-bold", PRIORITY_BG[priority])}>
                            {PRIORITY_LABELS[priority] ?? priority}
                          </span>
                        </td>
                        <td className="px-lg py-md">
                          {isOverdue ? (
                            <span className="font-body-md text-body-md text-secondary font-semibold">{t('repair.overdue')}</span>
                          ) : (
                            <span className="font-body-md text-body-md text-on-surface-variant font-medium">
                              {t('repair.status.' + repair.status) ?? repair.status.replace(/_/g, " ")}
                            </span>
                          )}
                        </td>
                        <td className="px-lg py-md text-right">
                    <Link
                      href={`/repairs/${repair.id}`}
                      className="inline-flex items-center gap-xs bg-primary/5 text-primary border border-primary/20 px-md py-xs rounded-lg font-label-sm text-label-sm hover:bg-primary hover:text-white transition-all"
                    >
                      {t('common.view')}
                      <Icon name="chevron_right" size={16} />
                    </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-md flex items-center justify-between border-t border-outline-variant bg-surface-container-low">
              <p className="font-label-sm text-label-sm text-on-surface-variant">{t('common.total')} : {repairs.length}</p>
              <div className="flex items-center gap-sm">
                <button className="p-xs rounded border border-outline-variant text-on-surface-variant hover:bg-white disabled:opacity-50" disabled>
                  <Icon name="chevron_left" size={20} />
                </button>
                <span className="font-label-sm text-label-sm px-sm font-bold">1</span>
                <button className="p-xs rounded border border-outline-variant text-on-surface-variant hover:bg-white">
                  <Icon name="chevron_right" size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
