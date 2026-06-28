"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CalendarRepair {
  id: string;
  status: string;
  priority: string;
  targetCompletionDate?: string;
  createdAt: string;
  car: { id: string; matricule: string; make: string; model: string };
  primaryMechanic: { id: string; name: string };
}

interface CalendarAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  purpose: string;
  requestedAt: string;
  status: string;
}

interface DayData {
  repairs: CalendarRepair[];
  appointments: CalendarAppointment[];
}

interface WeekDayData {
  date: string;
  repairs: CalendarRepair[];
  appointments: CalendarAppointment[];
}

interface MonthDayData {
  date: string;
  repairCount: number;
  appointmentCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  diagnosing: "bg-blue-100 text-blue-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  in_progress: "bg-purple-100 text-purple-700",
  waiting_for_parts: "bg-orange-100 text-orange-700",
  complete: "bg-emerald-100 text-emerald-700",
  delivered: "bg-slate-50 text-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  received: "Reçu",
  diagnosing: "Diagnostic",
  awaiting_approval: "En attente",
  in_progress: "En cours",
  waiting_for_parts: "Att. pièces",
  complete: "Terminé",
  delivered: "Livré",
};

const DAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// ─── Repair card (compact) ────────────────────────────────────────────────────

function RepairCard({
  repair,
  compact = false,
}: {
  repair: CalendarRepair;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/repairs/${repair.id}`}
      className={cn(
        "block rounded-md border px-2 py-1 transition-opacity hover:opacity-80",
        STATUS_CLASSES[repair.status] ?? "bg-muted text-muted-foreground",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <p className="font-semibold truncate">{repair.car.matricule}</p>
      {!compact && (
        <p className="truncate opacity-70">
          {repair.car.make} {repair.car.model}
        </p>
      )}
    </Link>
  );
}

// ─── Appointment card (compact) ───────────────────────────────────────────────

function AppointmentCard({
  appt,
  compact = false,
}: {
  appt: CalendarAppointment;
  compact?: boolean;
}) {
  const time = new Date(appt.requestedAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className={cn(
        "rounded-md border bg-indigo-50 px-2 py-1 text-indigo-700",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <p className="font-semibold truncate">{appt.clientName}</p>
      {!compact && (
        <p className="truncate opacity-70">
          {time} · {appt.purpose}
        </p>
      )}
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({ date }: { date: Date }) {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<{ data: DayData }>(`/calendar/day?date=${toISODate(date)}`)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Erreur de chargement.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const repairs = data?.repairs ?? [];
  const appointments = data?.appointments ?? [];

  if (repairs.length === 0 && appointments.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-muted-foreground">
          Aucune activité pour cette journée
        </p>
      </div>
    );
  }

  // Group repairs by mechanic
  const byMechanic = repairs.reduce<
    Record<
      string,
      { mechanic: CalendarRepair["primaryMechanic"]; repairs: CalendarRepair[] }
    >
  >((acc, r) => {
    const id = r.primaryMechanic.id;
    if (!acc[id]) acc[id] = { mechanic: r.primaryMechanic, repairs: [] };
    acc[id].repairs.push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Appointments */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rendez-vous ({appointments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Repairs by mechanic */}
      {Object.values(byMechanic).map(({ mechanic, repairs: mRepairs }) => (
        <Card key={mechanic.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {mechanic.name}
              <Badge variant="secondary" className="ml-2">
                {mRepairs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mRepairs.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <RepairCard repair={r} />
                <span
                  className={cn(
                    "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_CLASSES[r.status] ??
                      "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ weekStart }: { weekStart: Date }) {
  const [data, setData] = useState<WeekDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<{
        data: {
          weekStart: string;
          weekEnd: string;
          repairs: CalendarRepair[];
          appointments: CalendarAppointment[];
        };
      }>(`/calendar/week?startDate=${toISODate(weekStart)}`)
      .then((res) => {
        if (!cancelled) {
          // Group flat repairs/appointments into per-day buckets
          const { repairs, appointments } = res.data;
          const grouped: WeekDayData[] = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(weekStart, i);
            const iso = toISODate(d);
            return {
              date: iso,
              repairs: repairs.filter((r) => {
                const repairDate = r.targetCompletionDate
                  ? toISODate(new Date(r.targetCompletionDate))
                  : toISODate(new Date(r.createdAt));
                return repairDate === iso;
              }),
              appointments: appointments.filter(
                (a) => toISODate(new Date(a.requestedAt)) === iso,
              ),
            };
          });
          setData(grouped);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Erreur de chargement.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Build 7 days array from weekStart if API didn't return all
  const days: WeekDayData[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const iso = toISODate(d);
    return (
      data.find((x) => x.date === iso) ?? {
        date: iso,
        repairs: [],
        appointments: [],
      }
    );
  });

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Column headers */}
      {days.map((day, i) => {
        const d = new Date(day.date + "T00:00:00");
        const isToday = day.date === toISODate(new Date());
        return (
          <div
            key={day.date}
            className={cn(
              "rounded-t-md border-b pb-2 text-center text-xs font-semibold",
              isToday ? "text-primary" : "text-muted-foreground",
            )}
          >
            <p>{DAY_NAMES_FR[i]}</p>
            <p
              className={cn(
                "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                isToday && "bg-primary text-primary-foreground",
              )}
            >
              {d.getDate()}
            </p>
          </div>
        );
      })}

      {/* Day columns */}
      {days.map((day) => {
        const count = day.repairs.length + day.appointments.length;
        return (
          <div
            key={day.date}
            className={cn(
              "min-h-32 space-y-1 rounded-b-md border p-1",
              day.date === toISODate(new Date()) &&
                "bg-primary/5 border-primary/30",
            )}
          >
            {count === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground/40">
                —
              </p>
            )}
            {day.appointments.map((a) => (
              <AppointmentCard key={a.id} appt={a} compact />
            ))}
            {day.repairs.map((r) => (
              <RepairCard key={r.id} repair={r} compact />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  onDayClick,
}: {
  year: number;
  month: number;
  onDayClick: (date: Date) => void;
}) {
  const [data, setData] = useState<MonthDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<{ data: { year: number; month: number; days: MonthDayData[] } }>(
        `/calendar/month?year=${year}&month=${month}`,
      )
      .then((res) => {
        if (!cancelled) {
          setData(res.data.days ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Erreur de chargement.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() || 7) - 1; // 0 = Mon
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const todayStr = toISODate(new Date());

  function getDayData(dayNum: number): MonthDayData | undefined {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return data.find((d) => d.date === iso);
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES_FR.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const iso = isCurrentMonth
            ? `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            : null;
          const isToday = iso === todayStr;
          const dayData = isCurrentMonth ? getDayData(dayNum) : undefined;
          const total =
            (dayData?.repairCount ?? 0) + (dayData?.appointmentCount ?? 0);

          return (
            <div
              key={i}
              onClick={() => {
                if (isCurrentMonth) {
                  const d = new Date(year, month - 1, dayNum);
                  onDayClick(d);
                }
              }}
              className={cn(
                "min-h-20 border-b border-r p-2",
                isCurrentMonth
                  ? "cursor-pointer hover:bg-muted/30 transition-colors"
                  : "bg-muted/20",
                isToday && "bg-primary/5",
              )}
            >
              {isCurrentMonth && (
                <>
                  <p
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                      isToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-foreground",
                    )}
                  >
                    {dayNum}
                  </p>
                  {total > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {(dayData?.repairCount ?? 0) > 0 && (
                        <div className="rounded bg-purple-100 px-1 py-0.5 text-center text-xs font-medium text-purple-700">
                          {dayData!.repairCount} rép.
                        </div>
                      )}
                      {(dayData?.appointmentCount ?? 0) > 0 && (
                        <div className="rounded bg-indigo-100 px-1 py-0.5 text-center text-xs font-medium text-indigo-700">
                          {dayData!.appointmentCount} RDV
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  function navigate(direction: "prev" | "next") {
    const delta = direction === "next" ? 1 : -1;
    if (view === "day") {
      setCurrentDate((d) => addDays(d, delta));
    } else if (view === "week") {
      setCurrentDate((d) => addDays(d, delta * 7));
    } else {
      setCurrentDate((d) => addMonths(d, delta));
    }
  }

  function handleMonthDayClick(date: Date) {
    setCurrentDate(date);
    setView("day");
  }

  function getDateLabel(): string {
    if (view === "day") {
      return currentDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } else if (view === "week") {
      const start = getWeekStart(currentDate);
      const end = addDays(start, 6);
      const startStr = start.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      const endStr = end.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${startStr} – ${endStr}`;
    } else {
      return formatMonthLabel(currentDate);
    }
  }

  const weekStart = getWeekStart(currentDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Calendrier</h1>

        {/* View selector */}
        <div className="flex rounded-lg border bg-background p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("prev")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentDate(new Date())}
          className="text-xs"
        >
          Aujourd&apos;hui
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("next")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm font-medium capitalize">
          {getDateLabel()}
        </span>
      </div>

      {/* View content */}
      {view === "day" && <DayView date={currentDate} />}
      {view === "week" && <WeekView weekStart={weekStart} />}
      {view === "month" && (
        <Card>
          <CardContent className="p-0">
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth() + 1}
              onDayClick={handleMonthDayClick}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
