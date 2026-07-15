"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { useTranslations } from "next-intl";
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
  received: "bg-surface-container-low text-on-surface-variant",
  diagnosing: "bg-surface-container text-primary",
  awaiting_approval: "bg-surface-container-low text-on-surface-variant",
  in_progress: "bg-surface-container text-primary",
  waiting_for_parts: "bg-surface-container-low text-on-surface-variant",
  complete: "bg-surface-container text-primary",
  delivered: "bg-surface-container-low text-on-surface-variant",
};

const DAY_NAMES_KEYS = ["calendar.dayNames.0", "calendar.dayNames.1", "calendar.dayNames.2", "calendar.dayNames.3", "calendar.dayNames.4", "calendar.dayNames.5", "calendar.dayNames.6"];


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
        "block rounded-lg border border-outline-variant px-2 py-1 transition-opacity hover:opacity-80",
        STATUS_CLASSES[repair.status] ?? "bg-surface text-on-surface-variant",
        compact ? "font-body-md text-body-md" : "font-body-md text-body-md",
      )}
    >
      <p className="font-title-md text-title-md truncate">{repair.car.matricule}</p>
      {!compact && (
        <p className="truncate opacity-70 font-body-md text-body-md">
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
        "rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-on-surface-variant",
        compact ? "font-body-md text-body-md" : "font-body-md text-body-md",
      )}
    >
      <p className="font-title-md text-title-md truncate">{appt.clientName}</p>
      {!compact && (
        <p className="truncate opacity-70 font-body-md text-body-md">
          {time} · {appt.purpose}
        </p>
      )}
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({ date }: { date: Date }) {
  const t = useTranslations();
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
            err instanceof ApiError ? err.message : t('calendar.errors.loadFailed'),
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
        <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
        <Icon name="error" size={20} className="shrink-0 text-primary" />
        <p className="font-body-md text-body-md text-primary">{error}</p>
      </div>
    );
  }

  const repairs = data?.repairs ?? [];
  const appointments = data?.appointments ?? [];

  if (repairs.length === 0 && appointments.length === 0) {
    return (
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
        <Icon name="calendar_month" size={40} className="text-on-surface-variant/40" />
        <p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">
          {t('calendar.dayEmpty')}
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
    const id = r.primaryMechanic?.id ?? '__unassigned__';
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
            <CardTitle className="font-title-md text-title-md">
              {t('calendar.appointments').replace('{count}', String(appointments.length))}
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
        <Card key={mechanic?.id ?? '__unassigned__'}>
          <CardHeader>
            <CardTitle className="font-title-md text-title-md">
              {mechanic?.name ?? t('repair.unassigned')}
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
                    "inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm font-bold shrink-0",
                    STATUS_CLASSES[r.status] ??
                      "bg-surface text-on-surface-variant",
                  )}
                >
                  {t('repair.status.' + r.status) ?? r.status}
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
  const t = useTranslations();
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
            err instanceof ApiError ? err.message : t('calendar.errors.loadFailed'),
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
        <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
        <Icon name="error" size={20} className="shrink-0 text-primary" />
        <p className="font-body-md text-body-md text-primary">{error}</p>
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
              "rounded-t-lg border-b pb-2 text-center font-label-sm text-label-sm font-bold",
              isToday ? "text-primary" : "text-on-surface-variant",
            )}
          >
            <p>{t(DAY_NAMES_KEYS[i])}</p>
            <p
              className={cn(
                "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-body-md text-body-md",
                isToday && "bg-primary text-on-primary",
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
              "min-h-32 space-y-1 rounded-b-lg border border-outline-variant p-1",
              day.date === toISODate(new Date()) &&
                "bg-surface-container-low border-primary/30",
            )}
          >
            {count === 0 && (
              <p className="py-3 text-center font-body-md text-body-md text-on-surface-variant/40">
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
  const t = useTranslations();
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
            err instanceof ApiError ? err.message : t('calendar.errors.loadFailed'),
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
        <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
        <Icon name="error" size={20} className="shrink-0 text-primary" />
        <p className="font-body-md text-body-md text-primary">{error}</p>
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
      <div className="grid grid-cols-7 border-b border-outline-variant">
        {DAY_NAMES_KEYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center font-label-sm text-label-sm font-bold text-on-surface-variant"
          >
            {t(d)}
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
                "min-h-20 border-b border-r border-outline-variant p-2",
                isCurrentMonth
                  ? "cursor-pointer hover:bg-surface-container-low transition-colors"
                  : "bg-surface-container-low",
                isToday && "bg-surface-container-low",
              )}
            >
              {isCurrentMonth && (
                <>
                  <p
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full font-body-md text-body-md",
                      isToday
                        ? "bg-primary text-on-primary font-title-md text-title-md"
                        : "text-on-surface-variant",
                    )}
                  >
                    {dayNum}
                  </p>
                  {total > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {(dayData?.repairCount ?? 0) > 0 && (
                        <div className="rounded bg-surface-container px-1 py-0.5 text-center font-label-sm text-label-sm font-bold text-primary">
                          {t('calendar.repairAbbr').replace('{count}', String(dayData!.repairCount))}
                        </div>
                      )}
                      {(dayData?.appointmentCount ?? 0) > 0 && (
                        <div className="rounded bg-surface-container-low px-1 py-0.5 text-center font-label-sm text-label-sm font-bold text-on-surface-variant">
                          {t('calendar.appointmentAbbr').replace('{count}', String(dayData!.appointmentCount))}
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

type ViewMode = "week" | "month";

export default function CalendarPage() {
  const t = useTranslations();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  function navigate(direction: "prev" | "next") {
    const delta = direction === "next" ? 1 : -1;
    if (view === "week") {
      setCurrentDate((d) => addDays(d, delta * 7));
    } else {
      setCurrentDate((d) => addMonths(d, delta));
    }
  }

  function handleMonthDayClick(date: Date) {
    setCurrentDate(date);
    setView("week");
  }

  function getDateLabel(): string {
    if (view === "week") {
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('calendar.title')}</h2>
        </div>

        {/* View selector */}
        <div className="flex rounded-lg border border-outline-variant bg-surface p-0.5">
          {(["week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-lg py-sm text-title-md font-title-md transition-colors",
                view === v
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary",
              )}
            >
              {v === "week" ? t('calendar.weekView') : t('calendar.monthView')}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("prev")}>
          <Icon name="chevron_left" size={16} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentDate(new Date())}
          className="font-body-md text-body-md"
        >
          {t('calendar.today')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("next")}>
          <Icon name="chevron_right" size={16} />
        </Button>
        <span className="ml-2 font-title-md text-title-md capitalize">
          {getDateLabel()}
        </span>
      </div>

      {/* View content */}
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
