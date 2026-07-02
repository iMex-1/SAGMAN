import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';

const dashboard = new Hono<AppBindings>();
dashboard.use('/*', authenticate);

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { start: today.toISOString(), end: new Date(today.getTime() + 86400000).toISOString() };
    case 'week': {
      const dayOfWeek = today.getDay() || 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek + 1);
      return { start: monday.toISOString(), end: new Date(monday.getTime() + 7 * 86400000).toISOString() };
    }
    default: {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart.toISOString(), end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString() };
    }
  }
}

// GET /dashboard/overview
dashboard.get('/overview', authorize(['manager', 'overseer']), async (c) => {
  const query = c.req.query();
  const { start, end } = getDateRange(query.period ?? 'today');
  const now = new Date().toISOString();
  const year = parseInt(query.year ?? String(new Date().getFullYear()));
  const month = parseInt(query.month ?? String(new Date().getMonth() + 1)) - 1;
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 1).toISOString();

  const [revenueRow, carsReceived, deliveredRows, delayedCount, statusRows, overdueRows, lowStockRows,
    pendingCount, urgentRows, mechRows, completedGroups, delayGroups, paymentRows] = await Promise.all([
    c.env.DB.prepare(`SELECT COALESCE(SUM(CAST(final_total AS REAL)), 0) as total FROM payments WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ total: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM repair_jobs WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT actual_completion_date, target_completion_date, created_at FROM repair_jobs WHERE status = 'delivered' AND actual_completion_date >= ? AND actual_completion_date < ?`).bind(start, end).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM delay_reports WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT status, COUNT(*) as cnt FROM repair_jobs WHERE status NOT IN ('delivered', 'cancelled') GROUP BY status`).all<{ status: string; cnt: number }>(),
    c.env.DB.prepare(`SELECT rj.id, rj.target_completion_date, c.matricule, c.make, c.model, u.name as mech_name FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id LEFT JOIN users u ON u.id = rj.primary_mechanic_id WHERE rj.status NOT IN ('complete', 'delivered', 'cancelled') AND rj.target_completion_date IS NOT NULL AND rj.target_completion_date < ? AND rj.id NOT IN (SELECT repair_id FROM delay_reports) LIMIT 10`).bind(now).all<any>(),
    c.env.DB.prepare(`SELECT id, name, quantity, min_threshold FROM parts WHERE CAST(quantity AS INTEGER) <= CAST(min_threshold AS INTEGER) AND deleted_at IS NULL LIMIT 10`).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM appointments WHERE status = 'pending' AND deleted_at IS NULL`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT rj.id, rj.priority, rj.status, c.matricule, c.make, c.model FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id WHERE rj.priority IN ('high', 'emergency') AND rj.status NOT IN ('complete', 'delivered', 'cancelled') ORDER BY CASE rj.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 END, rj.created_at ASC LIMIT 10`).all<any>(),
    c.env.DB.prepare(`SELECT id, name FROM users WHERE role = 'mechanic' AND status = 'active'`).all<any>(),
    c.env.DB.prepare(`SELECT rm.mechanic_id, COUNT(*) as cnt FROM repair_mechanics rm LEFT JOIN repair_jobs rj ON rj.id = rm.repair_id WHERE rj.status = 'delivered' AND rj.actual_completion_date >= ? AND rj.actual_completion_date < ? GROUP BY rm.mechanic_id`).bind(monthStart, monthEnd).all<any>(),
    c.env.DB.prepare(`SELECT reported_by, COUNT(*) as cnt FROM delay_reports WHERE created_at >= ? AND created_at < ? GROUP BY reported_by`).bind(monthStart, monthEnd).all<any>(),
    c.env.DB.prepare(`SELECT CAST(created_at AS TEXT) as created_at, final_total FROM payments WHERE created_at >= ? AND created_at < ?`).bind(monthStart, monthEnd).all<any>(),
  ]);

  const totalRevenue = parseFloat(String(revenueRow?.total ?? '0'));
  const carsDelivered = deliveredRows.results ?? [];
  const onTime = carsDelivered.filter((r: any) => r.target_completion_date && r.actual_completion_date && r.actual_completion_date <= r.target_completion_date).length;
  const onTimeRate = carsDelivered.length > 0 ? Math.round((onTime / carsDelivered.length) * 100) : 100;
  const avgDuration = carsDelivered.length > 0
    ? carsDelivered.reduce((sum: number, r: any) => sum + (new Date(r.actual_completion_date).getTime() - new Date(r.created_at).getTime()) / 86400000, 0) / carsDelivered.length
    : 0;

  const mechanics = (mechRows.results ?? []).map((m: any) => ({
    mechanic: { id: m.id, name: m.name },
    carsCompleted: (completedGroups.results ?? []).find((g: any) => g.mechanic_id === m.id)?.cnt ?? 0,
    delays: (delayGroups.results ?? []).find((g: any) => g.reported_by === m.id)?.cnt ?? 0,
  }));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyRevenue: Record<number, number> = {};
  for (const p of (paymentRows.results ?? [])) {
    const day = new Date(p.created_at).getDate();
    dailyRevenue[day] = (dailyRevenue[day] ?? 0) + parseFloat(p.final_total ?? '0');
  }
  const revenueChart = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1, revenue: Math.round((dailyRevenue[i + 1] ?? 0) * 100) / 100,
  }));

  const statusMap: Record<string, number> = {};
  for (const s of (statusRows.results ?? [])) statusMap[s.status] = s.cnt;

  return c.json({
    data: {
      summary: {
        totalRevenue,
        carsReceived: carsReceived?.cnt ?? 0,
        carsDelivered: carsDelivered.length,
        avgRepairDurationDays: Math.round(avgDuration * 10) / 10,
        onTimeRate,
        delayedRepairs: delayedCount?.cnt ?? 0,
        period: query.period ?? 'today',
      },
      live: {
        activeByStatus: statusMap,
        overdueRepairs: overdueRows.results ?? [],
        overdueCount: (overdueRows.results ?? []).length,
        lowStockParts: (lowStockRows.results ?? []).map((p: any) => ({ ...p, minThreshold: p.min_threshold })),
        pendingAppointments: pendingCount?.cnt ?? 0,
        urgentRepairs: urgentRows.results ?? [],
      },
      mechanicPerformance: mechanics,
      revenueChart,
    },
  });
});

// GET /dashboard/summary
dashboard.get('/summary', authorize(['manager', 'overseer']), async (c) => {
  const query = c.req.query();
  const { start, end } = getDateRange(query.period ?? 'today');

  const [revenueRow, carsReceived, deliveredRows, delayedCount] = await Promise.all([
    c.env.DB.prepare(`SELECT COALESCE(SUM(CAST(final_total AS REAL)), 0) as total FROM payments WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ total: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM repair_jobs WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT actual_completion_date, target_completion_date, created_at FROM repair_jobs WHERE status = 'delivered' AND actual_completion_date >= ? AND actual_completion_date < ?`).bind(start, end).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM delay_reports WHERE created_at >= ? AND created_at < ?`).bind(start, end).first<{ cnt: number }>(),
  ]);

  const carsDelivered = deliveredRows.results ?? [];
  const onTime = carsDelivered.filter((r: any) => r.target_completion_date && r.actual_completion_date && r.actual_completion_date <= r.target_completion_date).length;
  const onTimeRate = carsDelivered.length > 0 ? Math.round((onTime / carsDelivered.length) * 100) : 100;
  const avgDuration = carsDelivered.length > 0
    ? carsDelivered.reduce((sum: number, r: any) => sum + (new Date(r.actual_completion_date).getTime() - new Date(r.created_at).getTime()) / 86400000, 0) / carsDelivered.length
    : 0;

  return c.json({
    data: {
      totalRevenue: parseFloat(String(revenueRow?.total ?? '0')),
      carsReceived: carsReceived?.cnt ?? 0,
      carsDelivered: carsDelivered.length,
      avgRepairDurationDays: Math.round(avgDuration * 10) / 10,
      onTimeRate,
      delayedRepairs: delayedCount?.cnt ?? 0,
      period: query.period ?? 'today',
    },
  });
});

// GET /dashboard/live
dashboard.get('/live', authorize(['manager']), async (c) => {
  const now = new Date().toISOString();

  const [statusRows, overdueRows, lowStockRows, pendingRow, urgentRows] = await Promise.all([
    c.env.DB.prepare(`SELECT status, COUNT(*) as cnt FROM repair_jobs WHERE status NOT IN ('delivered', 'cancelled') GROUP BY status`).all<{ status: string; cnt: number }>(),
    c.env.DB.prepare(`SELECT rj.id, rj.target_completion_date, c.matricule, c.make, c.model, u.name as mech_name FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id LEFT JOIN users u ON u.id = rj.primary_mechanic_id WHERE rj.status NOT IN ('complete', 'delivered', 'cancelled') AND rj.target_completion_date IS NOT NULL AND rj.target_completion_date < ? AND rj.id NOT IN (SELECT repair_id FROM delay_reports) LIMIT 10`).bind(now).all<any>(),
    c.env.DB.prepare(`SELECT id, name, CAST(quantity AS INTEGER) as quantity, CAST(min_threshold AS INTEGER) as min_threshold FROM parts WHERE CAST(quantity AS INTEGER) <= CAST(min_threshold AS INTEGER) AND deleted_at IS NULL LIMIT 10`).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM appointments WHERE status = 'pending' AND deleted_at IS NULL`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT rj.id, rj.priority, rj.status, c.matricule, c.make, c.model FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id WHERE rj.priority IN ('high', 'emergency') AND rj.status NOT IN ('complete', 'delivered', 'cancelled') ORDER BY CASE rj.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 END, rj.created_at ASC LIMIT 10`).all<any>(),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of (statusRows.results ?? [])) statusMap[s.status] = s.cnt;

  return c.json({
    data: {
      activeByStatus: statusMap,
      overdueRepairs: overdueRows.results ?? [],
      overdueCount: (overdueRows.results ?? []).length,
      lowStockParts: (lowStockRows.results ?? []).map((p: any) => ({ ...p, minThreshold: p.min_threshold })),
      pendingAppointments: pendingRow?.cnt ?? 0,
      urgentRepairs: urgentRows.results ?? [],
    },
  });
});

// GET /dashboard/mechanic-performance
dashboard.get('/mechanic-performance', authorize(['manager', 'overseer']), async (c) => {
  const query = c.req.query();
  const year = parseInt(query.year ?? String(new Date().getFullYear()));
  const month = parseInt(query.month ?? String(new Date().getMonth() + 1)) - 1;
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 1).toISOString();

  const mechanics = await c.env.DB.prepare(
    `SELECT id, name FROM users WHERE role = 'mechanic' AND status = 'active'`,
  ).all<any>();

  const performance = await Promise.all((mechanics.results ?? []).map(async (mech: any) => {
    const [completed, delays] = await Promise.all([
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM repair_jobs rj LEFT JOIN repair_mechanics rm ON rm.repair_id = rj.id WHERE rj.status = 'delivered' AND rj.actual_completion_date >= ? AND rj.actual_completion_date < ? AND rm.mechanic_id = ?`,
      ).bind(monthStart, monthEnd, mech.id).first<{ cnt: number }>(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM delay_reports WHERE reported_by = ? AND created_at >= ? AND created_at < ?`,
      ).bind(mech.id, monthStart, monthEnd).first<{ cnt: number }>(),
    ]);
    return { mechanic: mech, carsCompleted: completed?.cnt ?? 0, delays: delays?.cnt ?? 0 };
  }));

  return c.json({ data: performance });
});

// GET /dashboard/revenue-chart
dashboard.get('/revenue-chart', authorize(['manager', 'overseer']), async (c) => {
  const query = c.req.query();
  const year = parseInt(query.year ?? String(new Date().getFullYear()));
  const month = parseInt(query.month ?? String(new Date().getMonth() + 1)) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 1).toISOString();

  const payments = await c.env.DB.prepare(
    `SELECT CAST(created_at AS TEXT) as created_at, CAST(final_total AS REAL) as final_total FROM payments WHERE created_at >= ? AND created_at < ?`,
  ).bind(monthStart, monthEnd).all<any>();

  const dailyRevenue: Record<number, number> = {};
  for (const p of (payments.results ?? [])) {
    const day = new Date(p.created_at).getDate();
    dailyRevenue[day] = (dailyRevenue[day] ?? 0) + p.final_total;
  }

  const data = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    revenue: Math.round((dailyRevenue[i + 1] ?? 0) * 100) / 100,
  }));

  return c.json({ data });
});

export { dashboard };
