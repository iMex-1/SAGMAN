"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Car,
  CheckCircle,
  Clock,
  Target,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Summary {
  totalRevenue: number;
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function OverdueBanner({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium">
        ⚠ {count} réparation{count > 1 ? "s" : ""} en retard
      </p>
      <Link
        href="/repairs?status=overdue"
        className="ml-auto text-sm font-semibold underline-offset-2 hover:underline"
      >
        Voir tout
      </Link>
    </div>
  );
}

function LowStockBanner({
  parts,
}: {
  parts: Array<{
    id: string;
    name: string;
    quantity: number;
    minThreshold: number;
  }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium">
        ⚠ {parts.length} pièce{parts.length > 1 ? "s" : ""} en rupture de stock
      </p>
      <Link
        href="/stock?lowStock=true"
        className="ml-auto text-sm font-semibold underline-offset-2 hover:underline"
      >
        Gérer le stock
      </Link>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {value ?? "—"}
            </p>
          </div>
          <div className={cn("rounded-full bg-muted p-3", color)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Chiffre d&apos;affaires du mois
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v} DH`}
            />
            <Tooltip
              formatter={(v) => [`${Number(v).toFixed(2)} DH`, "Recettes"]}
            />
            <Bar
              dataKey="revenue"
              fill="hsl(var(--primary))"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const STATUS_LABELS: Record<string, string> = {
  received: "Reçu",
  diagnosing: "Diagnostic",
  awaiting_approval: "En attente",
  in_progress: "En cours",
  waiting_for_parts: "Att. pièces",
  complete: "Terminé",
  delivered: "Livré",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  received: "bg-slate-400",
  diagnosing: "bg-blue-500",
  awaiting_approval: "bg-amber-500",
  in_progress: "bg-purple-500",
  waiting_for_parts: "bg-orange-500",
  complete: "bg-emerald-500",
  delivered: "bg-slate-300",
};

function StatusBreakdown({
  activeByStatus,
}: {
  activeByStatus: Record<string, number>;
}) {
  const entries = Object.entries(activeByStatus);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Répartition par statut</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune réparation active
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      STATUS_DOT_COLORS[status] ?? "bg-muted-foreground",
                    )}
                  />
                  <span className="text-sm">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
                <span className="text-sm font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  emergency: "🚨 Urgence",
  high: "Haute",
  normal: "Normal",
  low: "Basse",
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Réparations urgentes</CardTitle>
      </CardHeader>
      <CardContent>
        {repairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune réparation urgente
          </p>
        ) : (
          <ul className="space-y-2">
            {repairs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/repairs/${r.id}`}
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-semibold">{r.car.matricule}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.car.make} {r.car.model}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-medium",
                      PRIORITY_STYLES[r.priority] ??
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {PRIORITY_LABELS[r.priority] ?? r.priority}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PendingAppointmentsCard({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rendez-vous en attente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-5xl font-bold">{count}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            rendez-vous en attente de confirmation
          </p>
          <Link
            href="/appointments"
            className="mt-4 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Gérer les rendez-vous →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function MechanicPerformanceTable({ data }: { data: MechanicPerf[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance des mécaniciens</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Aucune donnée disponible
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Mécanicien
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Véhicules terminés
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Retards
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => {
                const score =
                  row.carsCompleted > 0
                    ? Math.max(
                        0,
                        Math.round(
                          100 - (row.delays / row.carsCompleted) * 100,
                        ),
                      )
                    : 100;
                return (
                  <tr
                    key={row.mechanic.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.mechanic.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.carsCompleted}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          row.delays > 0
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {row.delays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          score >= 80
                            ? "bg-emerald-100 text-emerald-700"
                            : score >= 60
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700",
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
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
        const [summaryRes, liveRes, perfRes, chartRes] = await Promise.all([
          api.get<{ data: Summary }>(`/dashboard/summary?period=${period}`),
          api.get<{ data: LiveData }>("/dashboard/live"),
          api.get<{ data: MechanicPerf[] }>("/dashboard/mechanic-performance"),
          api.get<{ data: RevenuePoint[] }>("/dashboard/revenue-chart"),
        ]);
        if (cancelled) return;
        setSummary(summaryRes.data);
        setLive(liveRes.data);
        setMechanicPerf(perfRes.data);
        setRevenueData(chartRes.data);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Erreur lors du chargement des données.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <div className="flex rounded-lg border bg-background p-0.5">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "today"
                ? "Aujourd'hui"
                : p === "week"
                  ? "Cette semaine"
                  : "Ce mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Alert banners */}
      {live && live.overdueCount > 0 && (
        <OverdueBanner count={live.overdueCount} />
      )}
      {live && live.lowStockParts.length > 0 && (
        <LowStockBanner parts={live.lowStockParts} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI cards grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Chiffre d'affaires"
              value={`${Number(summary?.totalRevenue ?? 0).toFixed(2)} DH`}
              icon={TrendingUp}
              color="text-emerald-600"
            />
            <KpiCard
              title="Véhicules reçus"
              value={summary?.carsReceived}
              icon={Car}
              color="text-blue-600"
            />
            <KpiCard
              title="Véhicules livrés"
              value={summary?.carsDelivered}
              icon={CheckCircle}
              color="text-emerald-600"
            />
            <KpiCard
              title="Durée moyenne"
              value={`${summary?.avgRepairDurationDays ?? 0} j`}
              icon={Clock}
              color="text-amber-600"
            />
            <KpiCard
              title="Taux de ponctualité"
              value={`${summary?.onTimeRate ?? 0}%`}
              icon={Target}
              color="text-purple-600"
            />
            <KpiCard
              title="Réparations en retard"
              value={summary?.delayedRepairs}
              icon={AlertTriangle}
              color="text-red-600"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue chart — 2/3 width */}
            <div className="lg:col-span-2">
              <RevenueChart data={revenueData} />
            </div>
            {/* Status breakdown — 1/3 width */}
            <div>
              <StatusBreakdown activeByStatus={live?.activeByStatus ?? {}} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <UrgentRepairsCard repairs={live?.urgentRepairs ?? []} />
            <PendingAppointmentsCard count={live?.pendingAppointments ?? 0} />
          </div>

          {/* Mechanic performance table */}
          <MechanicPerformanceTable data={mechanicPerf} />
        </>
      )}
    </div>
  );
}
