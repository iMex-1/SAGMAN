"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, ApiError } from "@/lib/api-client";
import { authStorage } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/ui/kpi-card";
import { DesignCard, DesignCardTitle } from "@/components/ui/design-card";

interface Summary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  carsReceived: number;
  carsDelivered: number;
  avgRepairDurationDays: number;
  onTimeRate: number;
  delayedRepairs: number;
  period: string;
}

interface LiveData {
  activeByStatus: Record<string, number>;
  overdueRepairs: Array<{
    id: string;
    car: { matricule: string; make: string; model: string };
    primaryMechanic: { name: string };
  }>;
  overdueCount: number;
  lowStockParts: Array<{
    id: string;
    name: string;
    quantity: number;
    minThreshold: number;
  }>;
  pendingAppointments: number;
  urgentRepairs: Array<{
    id: string;
    priority: string;
    car: { matricule: string; make: string; model: string };
  }>;
}

interface MechanicPerf {
  mechanic: { id: string; name: string };
  carsCompleted: number;
  delays: number;
}

interface RevenuePoint {
  day: number;
  revenue: number;
}

type Period = "today" | "week" | "month";

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const t = useTranslations();
  return (
    <DesignCard padding={false}>
      <div className="p-lg border-b border-outline-variant">
        <DesignCardTitle>{t('dashboard.revenueChart')}</DesignCardTitle>
      </div>
      <div className="p-lg">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v} DH`} />
            <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} DH`, t('dashboard.totalRevenue')]} />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DesignCard>
  );
}

const STATUS_COLORS: Record<string, string> = {
  received: "text-slate-500",
  diagnosing: "text-blue-600",
  awaiting_approval: "text-amber-600",
  in_progress: "text-purple-600",
  waiting_for_parts: "text-orange-600",
  complete: "text-emerald-600",
  delivered: "text-slate-400",
};

const STATUS_STROKE: Record<string, string> = {
  received: "#64748b",
  diagnosing: "#2563eb",
  awaiting_approval: "#d97706",
  in_progress: "#9333ea",
  waiting_for_parts: "#ea580c",
  complete: "#059669",
  delivered: "#94a3b8",
};

function StatusBreakdown({ activeByStatus }: { activeByStatus: Record<string, number> }) {
  const t = useTranslations();
  const entries = Object.entries(activeByStatus);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const CIRCUMFERENCE = 100;

  let cumulative = 0;
  const segments = entries.map(([status, count]) => {
    const pct = total > 0 ? (count / total) * CIRCUMFERENCE : 0;
    const offset = cumulative;
    cumulative += pct;
    return { status, count, pct, stroke: STATUS_STROKE[status] ?? "#eceef0", offset };
  });

  return (
    <DesignCard>
      <DesignCardTitle>{t('dashboard.activeRepairs')}</DesignCardTitle>
      <div className="mt-lg flex flex-col items-center">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#eceef0" strokeWidth="3" />
            {segments.map((s) => (
              <circle
                key={s.status}
                cx="18" cy="18" fill="transparent" r="15.915"
                stroke={s.stroke}
                strokeWidth="3"
                strokeDasharray={`${s.pct} ${CIRCUMFERENCE - s.pct}`}
                strokeDashoffset={s.offset === 0 ? "0" : `-${s.offset}`}
              />
            ))}
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-headline-lg text-headline-lg text-primary">{total}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{t('common.total')}</span>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="mt-lg text-sm text-on-surface-variant">{t('dashboard.noActiveRepairs')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-md mt-lg w-full">
            {segments.map((s) => (
              <div key={s.status} className="flex items-center gap-xs">
                <span className={cn("w-3 h-3 rounded-full", STATUS_COLORS[s.status]?.replace("text-", "bg-") ?? "bg-muted")} />
                <span className="font-body-md text-body-md text-on-surface-variant">
                  {t('repair.status.' + s.status)} ({s.count})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DesignCard>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-secondary-container/10 text-secondary",
  high: "bg-secondary-container/10 text-secondary",
  normal: "bg-primary-container/10 text-primary",
  low: "bg-surface-container-highest text-on-surface-variant",
};

function UrgentRepairsCard({
  repairs,
}: {
  repairs: Array<{
    id: string;
    priority: string;
    car: { matricule: string; make: string; model: string };
  }>;
}) {
  const t = useTranslations();
  return (
    <DesignCard padding={false}>
      <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <DesignCardTitle>{t('dashboard.emergencyRepairs')}</DesignCardTitle>
        <Link href="/repairs?status=overdue" className="text-primary font-bold text-body-md hover:underline transition-all">
          {t('common.viewAll')}
        </Link>
      </div>
      <div>
        {repairs.length === 0 ? (
          <p className="p-lg text-sm text-on-surface-variant">{t('dashboard.noUrgentRepairs')}</p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {repairs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/repairs/${r.id}`}
                  className="flex items-center gap-md p-lg hover:bg-surface-container-lowest transition-colors"
                >
                  <div className="w-10 h-10 bg-primary-container/10 flex items-center justify-center rounded text-primary">
                    <Icon name="car_repair" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-body-md text-body-md font-bold">{r.car.matricule}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {r.car.make} {r.car.model}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-sm py-xs rounded-full font-label-sm text-label-sm font-bold",
                      PRIORITY_STYLES[r.priority] ?? "bg-surface-container-highest text-on-surface-variant",
                    )}
                  >
                    {t('repair.priority.' + r.priority) ?? r.priority}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DesignCard>
  );
}

function PendingAppointmentsCard({ count }: { count: number }) {
  const t = useTranslations();
  return (
    <DesignCard>
      <div className="flex items-center justify-between mb-lg">
        <DesignCardTitle>{t('dashboard.pendingAppointments')}</DesignCardTitle>
        <span className="bg-primary text-on-primary px-sm py-xs rounded-full font-label-sm text-label-sm">
          {count} {t('common.today')}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-5xl font-bold text-primary">{count}</p>
        <p className="mt-2 text-sm text-on-surface-variant">{t('dashboard.pendingAppointments')}</p>
        <Link
          href="/appointments"
          className="mt-4 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('appointment.title')} →
        </Link>
      </div>
    </DesignCard>
  );
}

function MechanicPerformanceTable({ data }: { data: MechanicPerf[] }) {
  const t = useTranslations();
  return (
    <DesignCard padding={false}>
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
        <DesignCardTitle>{t('dashboard.mechanicPerformance')}</DesignCardTitle>
      </div>
      {data.length === 0 ? (
        <p className="p-lg text-sm text-on-surface-variant">{t('common.noData')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest text-on-surface-variant border-b border-outline-variant">
                <th className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider">{t('repair.fields.mechanic')}</th>
                <th className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-center">{t('dashboard.carsCompleted')}</th>
                <th className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-center">{t('dashboard.delays')}</th>
                <th className="px-lg py-md font-label-sm text-label-sm uppercase tracking-wider text-center">{t('dashboard.score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.map((row) => {
                const score = row.carsCompleted > 0
                  ? Math.max(0, Math.round(100 - (row.delays / row.carsCompleted) * 100))
                  : 100;
                return (
                  <tr key={row.mechanic.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-lg py-md">
                      <div className="flex items-center gap-xs">
                        <Icon name="engineering" size={20} className="text-primary" />
                        <p className="font-body-md text-body-md font-medium">{row.mechanic.name}</p>
                      </div>
                    </td>
                    <td className="px-lg py-md text-center font-body-md text-body-md">{row.carsCompleted}</td>
                    <td className="px-lg py-md text-center">
                      <span className={row.delays > 0 ? "text-secondary font-medium" : "text-on-surface-variant"}>
                        {row.delays}
                      </span>
                    </td>
                    <td className="px-lg py-md text-center">
                      <span
                        className={cn(
                          "rounded-full px-sm py-xs text-label-sm font-semibold",
                          score >= 80 ? "bg-primary-fixed text-primary" : score >= 60 ? "bg-amber-100 text-amber-700" : "bg-secondary-fixed text-secondary",
                        )}
                      >
                        {score}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DesignCard>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    const user = authStorage.getUser();
    if (user && "role" in user && user.role === "mechanic") {
      router.replace("/repairs");
    }
  }, [router]);

  const [period, setPeriod] = useState<Period>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [live, setLive] = useState<LiveData | null>(null);
  const [mechanicPerf, setMechanicPerf] = useState<MechanicPerf[]>([]);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const overviewRes = await api.get<{
          data: {
            summary: Summary;
            live: LiveData;
            mechanicPerformance: MechanicPerf[];
            revenueChart: RevenuePoint[];
          };
        }>(`/dashboard/overview?period=${period}`);
        if (cancelled) return;
        setSummary(overviewRes.data.summary);
        setLive(overviewRes.data.live);
        setMechanicPerf(overviewRes.data.mechanicPerformance);
        setRevenueData(overviewRes.data.revenueChart);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t('common.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [period]);

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-primary">{t('dashboard.title')}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center bg-surface-container rounded-lg p-xs border border-outline-variant">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-lg py-sm rounded font-label-sm text-label-sm transition-colors",
                period === p
                  ? "bg-white shadow-sm text-primary font-bold"
                  : "text-on-surface-variant hover:bg-white/50",
              )}
            >
              {p === "today" ? t('dashboard.today') : p === "week" ? t('dashboard.thisWeek') : t('dashboard.thisMonth')}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-error/50 bg-error-container/20 p-4 text-error">
          <Icon name="error" size={20} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Alert banners */}
      {live && live.overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-secondary-fixed-dim bg-secondary-fixed/30 px-4 py-3 text-secondary">
          <Icon name="warning" size={20} filled />
          <p className="text-sm font-medium">
            {live.overdueCount} {t('repair.overdue')}
          </p>
          <Link href="/repairs?status=overdue" className="ml-auto text-sm font-semibold underline-offset-2 hover:underline">
            {t('common.viewAll')}
          </Link>
        </div>
      )}
      {live && live.lowStockParts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <Icon name="inventory_2" size={20} />
          <p className="text-sm font-medium">
            {live.lowStockParts.length} {t('stock.lowStock')}
          </p>
          <Link href="/stock?lowStock=true" className="ml-auto text-sm font-semibold underline-offset-2 hover:underline">
            {t('stock.title')}
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Icon name="sync" size={40} className="text-on-surface-variant animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-md">
            <KpiCard
              title={t('dashboard.totalRevenue')}
              value={`${Number(summary?.totalRevenue ?? 0).toFixed(2)} MAD`}
              icon="payments"
              iconBg="bg-primary-fixed"
              iconColor="text-primary"
            />
            <KpiCard
              title={t('dashboard.totalExpenses')}
              value={`${Number(summary?.totalExpenses ?? 0).toFixed(2)} MAD`}
              icon="shopping_cart"
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
            />
            <KpiCard
              title={t('dashboard.netProfit')}
              value={`${Number(summary?.netProfit ?? 0).toFixed(2)} MAD`}
              icon="trending_up"
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <KpiCard title={t('dashboard.carsReceived')} value={summary?.carsReceived} icon="directions_car" iconBg="bg-primary-fixed" iconColor="text-primary" />
            <KpiCard title={t('dashboard.carsDelivered')} value={summary?.carsDelivered} icon="task_alt" iconBg="bg-green-100" iconColor="text-green-600" />
            <KpiCard
              title={t('dashboard.delayedRepairs')}
              value={summary?.delayedRepairs}
              icon="warning"
              iconBg="bg-secondary-fixed"
              iconColor="text-secondary"
              className="border-2 border-secondary bg-secondary-fixed/20"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            <div className="lg:col-span-2">
              <RevenueChart data={revenueData} />
            </div>
            <div>
              <StatusBreakdown activeByStatus={live?.activeByStatus ?? {}} />
            </div>
          </div>

          {/* Bottom grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-lg">
            <div className="xl:col-span-2">
              <UrgentRepairsCard repairs={live?.urgentRepairs ?? []} />
            </div>
            <div>
              <PendingAppointmentsCard count={live?.pendingAppointments ?? 0} />
            </div>
          </div>

          {/* Mechanic performance */}
          <MechanicPerformanceTable data={mechanicPerf} />
        </>
      )}
    </div>
  );
}
