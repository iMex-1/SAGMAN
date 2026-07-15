import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';

const calendar = new Hono<AppBindings>();
calendar.use('/*', authenticate);

function mapAppointment(a: any) {
  return {
    id: a.id,
    clientId: a.client_id,
    clientName: a.client_name,
    clientPhone: a.client_phone,
    carId: a.car_id,
    carMatricule: a.car_matricule,
    purpose: a.purpose,
    requestedAt: a.requested_at,
    status: a.status,
    notes: a.notes,
    car: a.c_id ? { id: a.c_id, matricule: a.matricule, make: a.make, model: a.model } : undefined,
  };
}

// GET /calendar/day
calendar.get('/day', authorize(['manager', 'mechanic', 'overseer']), async (c) => {
  const user = c.get('user');
  const date = c.req.query('date');
  const targetDate = date ? new Date(date) : new Date();
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toISOString();
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1).toISOString();

  let repairWhere = `WHERE rj.status NOT IN ('delivered', 'cancelled') AND ((rj.created_at >= ? AND rj.created_at < ?) OR (rj.target_completion_date >= ? AND rj.target_completion_date < ?) OR (rj.created_at < ? AND (rj.target_completion_date IS NULL OR rj.target_completion_date >= ?)))`;
  const params = [dayStart, dayEnd, dayStart, dayEnd, dayEnd, dayStart];

  if (user.role === 'mechanic') {
    repairWhere += ` AND rj.id IN (SELECT repair_id FROM repair_mechanics WHERE mechanic_id = ?)`;
    params.push(user.sub);
  }

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.status, rj.priority, rj.description, rj.created_at, rj.target_completion_date,
            c.id as c_id, c.matricule, c.make, c.model,
            u.id as mech_id, u.name as mech_name
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     ${repairWhere}
     ORDER BY CASE rj.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END, rj.created_at ASC`,
  ).bind(...params).all<any>();

  const mechanics = await c.env.DB.prepare(
    `SELECT rm.repair_id, rm.mechanic_id, u.id, u.name FROM repair_mechanics rm LEFT JOIN users u ON u.id = rm.mechanic_id WHERE rm.repair_id IN (SELECT id FROM repair_jobs ${repairWhere})`,
  ).bind(...params).all<any>();

  const mechanicsByRepair: Record<string, any[]> = {};
  for (const m of mechanics.results ?? []) {
    if (!mechanicsByRepair[m.repair_id]) mechanicsByRepair[m.repair_id] = [];
    mechanicsByRepair[m.repair_id].push({ mechanic: { id: m.id, name: m.name } });
  }

  const appointments = await c.env.DB.prepare(
    `SELECT a.*, c.id as c_id, c.matricule, c.make, c.model
     FROM appointments a
     LEFT JOIN cars c ON c.id = a.car_id
     WHERE a.status IN ('confirmed', 'rescheduled') AND a.requested_at >= ? AND a.requested_at < ? AND a.deleted_at IS NULL`,
  ).bind(dayStart, dayEnd).all<any>();

  const repairData = (repairs.results ?? []).map((r: any) => ({
    id: r.id, status: r.status, priority: r.priority, description: r.description,
    createdAt: r.created_at, targetCompletionDate: r.target_completion_date,
    car: { id: r.c_id, matricule: r.matricule, make: r.make, model: r.model },
    primaryMechanic: r.mech_id ? { id: r.mech_id, name: r.mech_name } : null,
    mechanics: mechanicsByRepair[r.id] ?? [],
  }));

  return c.json({
    data: {
      date: dayStart,
      repairs: repairData,
      appointments: (appointments.results ?? []).map(mapAppointment),
    },
  });
});

// GET /calendar/week
calendar.get('/week', authorize(['manager', 'mechanic', 'overseer']), async (c) => {
  const user = c.get('user');
  const startDate = c.req.query('startDate');
  const weekStart = startDate ? new Date(startDate) : new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const ws = weekStart.toISOString();
  const we = weekEnd.toISOString();

  let repairWhere = `WHERE rj.status != 'cancelled' AND ((rj.target_completion_date >= ? AND rj.target_completion_date < ?) OR (rj.created_at < ? AND rj.status NOT IN ('delivered', 'cancelled')))`;
  const params = [ws, we, we];

  if (user.role === 'mechanic') {
    repairWhere += ` AND rj.id IN (SELECT repair_id FROM repair_mechanics WHERE mechanic_id = ?)`;
    params.push(user.sub);
  }

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.status, rj.priority, rj.description, rj.created_at, rj.target_completion_date,
            c.id as c_id, c.matricule, c.make, c.model,
            u.id as mech_id, u.name as mech_name
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     ${repairWhere}
     ORDER BY rj.target_completion_date ASC LIMIT 100`,
  ).bind(...params).all<any>();

  const appointments = await c.env.DB.prepare(
    `SELECT a.*, c.id as c_id, c.matricule, c.make, c.model
     FROM appointments a
     LEFT JOIN cars c ON c.id = a.car_id
     WHERE a.status IN ('confirmed', 'rescheduled') AND a.requested_at >= ? AND a.requested_at < ? AND a.deleted_at IS NULL ORDER BY a.requested_at ASC`,
  ).bind(ws, we).all<any>();

  const repairData = (repairs.results ?? []).map((r: any) => ({
    id: r.id, status: r.status, priority: r.priority, description: r.description,
    createdAt: r.created_at, targetCompletionDate: r.target_completion_date,
    car: { id: r.c_id, matricule: r.matricule, make: r.make, model: r.model },
    primaryMechanic: r.mech_id ? { id: r.mech_id, name: r.mech_name } : null,
  }));

  return c.json({
    data: {
      weekStart: ws, weekEnd: we,
      repairs: repairData,
      appointments: (appointments.results ?? []).map(mapAppointment),
    },
  });
});

// GET /calendar/month
calendar.get('/month', authorize(['manager', 'mechanic', 'overseer']), async (c) => {
  const now = new Date();
  const query = c.req.query();
  const y = parseInt(query.year ?? String(now.getFullYear()));
  const m = parseInt(query.month ?? String(now.getMonth() + 1)) - 1;
  const monthStart = new Date(y, m, 1).toISOString();
  const monthEnd = new Date(y, m + 1, 1).toISOString();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const repairs = await c.env.DB.prepare(
    `SELECT created_at, target_completion_date, status FROM repair_jobs WHERE status != 'cancelled' AND ((created_at >= ? AND created_at < ?) OR (target_completion_date >= ? AND target_completion_date < ?))`,
  ).bind(monthStart, monthEnd, monthStart, monthEnd).all<any>();

  const appointments = await c.env.DB.prepare(
    `SELECT requested_at FROM appointments WHERE status IN ('confirmed', 'rescheduled') AND requested_at >= ? AND requested_at < ? AND deleted_at IS NULL`,
  ).bind(monthStart, monthEnd).all<any>();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayDate = new Date(y, m, i + 1);
    const nextDay = new Date(y, m, i + 2);
    const repairCount = (repairs.results ?? []).filter((r: any) =>
      (r.created_at >= dayDate.toISOString() && r.created_at < nextDay.toISOString()) ||
      (r.target_completion_date && r.target_completion_date >= dayDate.toISOString() && r.target_completion_date < nextDay.toISOString())
    ).length;
    const apptCount = (appointments.results ?? []).filter((a: any) =>
      a.requested_at >= dayDate.toISOString() && a.requested_at < nextDay.toISOString()
    ).length;
    return {
      date: dayDate.toISOString().split('T')[0],
      repairCount,
      appointmentCount: apptCount,
      total: repairCount + apptCount,
    };
  });

  return c.json({ data: { year: y, month: m + 1, days } });
});

export { calendar };
