import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';
import { TERMINAL_STATUSES, ACTIVE_STATUSES, isTransitionAllowed, isOverdue, computeTotals } from '../../services/repair.service';

const repairs = new Hono<AppBindings>();
repairs.use('/*', authenticate);

async function recalculateTotals(db: D1Database, repairId: string) {
  const parts = await db.prepare(
    `SELECT quantity_used, unit_cost_at_time FROM repair_parts WHERE repair_id = ?`,
  ).bind(repairId).all<{ quantity_used: string; unit_cost_at_time: string }>();

  const labor = await db.prepare(
    `SELECT cost FROM labor_items WHERE repair_id = ?`,
  ).bind(repairId).all<{ cost: string }>();

  const repair = await db.prepare(
    `SELECT discount_amount FROM repair_jobs WHERE id = ?`,
  ).bind(repairId).first<{ discount_amount: string }>();

  if (!repair) return;

  const partsData = (parts.results ?? []).map((p) => ({
    quantityUsed: parseInt(p.quantity_used),
    unitCostAtTime: parseFloat(p.unit_cost_at_time),
  }));
  const laborData = (labor.results ?? []).map((l) => ({ cost: parseFloat(l.cost) }));
  const discount = parseFloat(repair.discount_amount ?? '0');

  const totals = computeTotals(partsData, laborData, discount);
  await db.prepare(
    `UPDATE repair_jobs SET parts_total = ?, labor_total = ?, final_total = ?, estimated_cost = ? WHERE id = ?`,
  ).bind(
    String(totals.partsTotal), String(totals.laborTotal),
    String(totals.finalTotal), String(totals.finalTotal), repairId,
  ).run();
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface D1PreparedStatement {
  bind(...args: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results?: T[] }>;
}
interface D1Result { success: boolean; meta?: any; }

// GET /repairs
repairs.get('/', authorize(['manager', 'mechanic']), async (c) => {
  const user = c.get('user');
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  let whereSql = 'WHERE 1=1';
  const params: string[] = [];

  if (user.role === 'mechanic') {
    whereSql += ' AND rj.id IN (SELECT repair_id FROM repair_mechanics WHERE mechanic_id = ?)';
    params.push(user.sub);
  } else if (query.mechanicId) {
    whereSql += ' AND rj.id IN (SELECT repair_id FROM repair_mechanics WHERE mechanic_id = ?)';
    params.push(query.mechanicId);
  }

  if (query.status) {
    const statuses = query.status.split(',').map((s: string) => s.trim());
    whereSql += ` AND rj.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }

  if (query.priority) {
    whereSql += ' AND rj.priority = ?';
    params.push(query.priority);
  }

  if (query.isOverdue === 'true') {
    whereSql += ` AND rj.target_completion_date IS NOT NULL AND rj.target_completion_date < ? AND rj.status NOT IN ('complete', 'delivered', 'cancelled')`;
    params.push(new Date().toISOString());
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM repair_jobs rj ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT rj.id, rj.car_id, rj.status, rj.priority, rj.description, rj.created_at, rj.target_completion_date,
            c.matricule, c.make, c.model,
            u.id as mech_id, u.name as mech_name,
            (SELECT COUNT(*) FROM repair_mechanics rm2 WHERE rm2.repair_id = rj.id) as mechanic_count,
            (SELECT COUNT(*) FROM delay_reports dr WHERE dr.repair_id = rj.id) as delay_count
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     ${whereSql}
     ORDER BY
       CASE rj.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
       rj.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    carId: r.car_id,
    status: r.status,
    priority: r.priority,
    description: r.description,
    createdAt: r.created_at,
    targetCompletionDate: r.target_completion_date,
    isOverdue: isOverdue({ status: r.status, targetCompletionDate: r.target_completion_date }),
    car: { id: r.car_id, matricule: r.matricule, make: r.make, model: r.model },
    primaryMechanic: r.mech_id ? { id: r.mech_id, name: r.mech_name } : null,
    _count: { mechanics: r.mechanic_count ?? 0, delayReports: r.delay_count ?? 0 },
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

// POST /repairs
repairs.post('/', authorize(['manager']), async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as any;

  const active = await c.env.DB.prepare(
    `SELECT id FROM repair_jobs WHERE car_id = ? AND status NOT IN ('delivered', 'cancelled')`,
  ).bind(body.carId).first();
  if (active) throw Errors.BusinessRule('CAR_HAS_ACTIVE_REPAIR', 'This car already has an active repair job');

  const car = await c.env.DB.prepare(`SELECT id FROM cars WHERE id = ? AND deleted_at IS NULL`).bind(body.carId).first();
  if (!car) throw Errors.NotFound('Car', body.carId);

  const mechanic = await c.env.DB.prepare(
    `SELECT id, status, role FROM users WHERE id = ?`,
  ).bind(body.primaryMechanicId).first<{ id: string; status: string; role: string }>();
  if (!mechanic || mechanic.status !== 'active' || mechanic.role !== 'mechanic') {
    throw Errors.BadRequest('The assigned mechanic does not exist, is not active, or does not have the mechanic role', 'INVALID_MECHANIC');
  }

  const repairId = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO repair_jobs (id, car_id, appointment_id, created_by, primary_mechanic_id, status, priority, description, internal_notes, estimated_duration_hours, target_completion_date)
       VALUES (?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?)`,
    ).bind(repairId, body.carId, body.appointmentId ?? null, user.sub, body.primaryMechanicId,
      body.priority ?? 'normal', body.description, body.internalNotes ?? null,
      body.estimatedDurationHours != null ? String(body.estimatedDurationHours) : null,
      body.targetCompletionDate ?? null),
    c.env.DB.prepare(
      `INSERT INTO repair_mechanics (repair_id, mechanic_id, is_primary) VALUES (?, ?, '1')`,
    ).bind(repairId, body.primaryMechanicId),
    c.env.DB.prepare(
      `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by)
       VALUES (?, ?, NULL, 'received', ?)`,
    ).bind(crypto.randomUUID(), repairId, user.sub),
  ];

  if (body.secondaryMechanicIds?.length > 0) {
    for (const mid of body.secondaryMechanicIds) {
      stmts.push(c.env.DB.prepare(
        `INSERT OR IGNORE INTO repair_mechanics (repair_id, mechanic_id, is_primary) VALUES (?, ?, '0')`,
      ).bind(repairId, mid));
    }
  }

  await c.env.DB.batch(stmts as any);

  return c.json({ data: { id: repairId, ...body } }, 201);
});

// GET /repairs/:id
repairs.get('/:id', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  const row = await c.env.DB.prepare(
    `SELECT * FROM repair_jobs WHERE id = ?`,
  ).bind(id).first<any>();
  if (!row) throw Errors.NotFound('Repair', id);

  const car = await c.env.DB.prepare(
    `SELECT c.*, u.id as cl_id, u.name as cl_name, u.phone as cl_phone
     FROM cars c LEFT JOIN users u ON u.id = c.client_id WHERE c.id = ?`,
  ).bind(row.car_id).first<any>();

  const appointment = await c.env.DB.prepare(
    `SELECT id, status, purpose FROM appointments WHERE id = ?`,
  ).bind(row.appointment_id).first<any>();

  const createdBy = await c.env.DB.prepare(
    `SELECT id, name FROM users WHERE id = ?`,
  ).bind(row.created_by).first<any>();

  const primaryMechanic = await c.env.DB.prepare(
    `SELECT id, name, specialty FROM users WHERE id = ?`,
  ).bind(row.primary_mechanic_id).first<any>();

  const mechanics = await c.env.DB.prepare(
    `SELECT rm.repair_id, rm.mechanic_id, rm.is_primary,
            u.id, u.name, u.specialty
     FROM repair_mechanics rm
     LEFT JOIN users u ON u.id = rm.mechanic_id
     WHERE rm.repair_id = ?`,
  ).bind(id).all<any>();

  const statusLogs = await c.env.DB.prepare(
    `SELECT sl.*, u.name as changed_by_name
     FROM repair_status_logs sl
     LEFT JOIN users u ON u.id = sl.changed_by
     WHERE sl.repair_id = ?
     ORDER BY sl.created_at ASC`,
  ).bind(id).all<any>();

  const workLogs = await c.env.DB.prepare(
    `SELECT wl.*, u.name as mechanic_name
     FROM repair_work_logs wl
     LEFT JOIN users u ON u.id = wl.mechanic_id
     WHERE wl.repair_id = ?
     ORDER BY wl.logged_at DESC`,
  ).bind(id).all<any>();

  const delayReports = await c.env.DB.prepare(
    `SELECT dr.*, u.name as reported_by_name
     FROM delay_reports dr
     LEFT JOIN users u ON u.id = dr.reported_by
     WHERE dr.repair_id = ?
     ORDER BY dr.created_at DESC`,
  ).bind(id).all<any>();

  const parts = await c.env.DB.prepare(
    `SELECT rp.*, p.name as part_name, p.reference as part_reference, p.category as part_category
     FROM repair_parts rp
     LEFT JOIN parts p ON p.id = rp.part_id
     WHERE rp.repair_id = ?
     ORDER BY rp.added_at DESC`,
  ).bind(id).all<any>();

  const laborItems = await c.env.DB.prepare(
    `SELECT * FROM labor_items WHERE repair_id = ? ORDER BY added_at DESC`,
  ).bind(id).all<any>();

  const payment = await c.env.DB.prepare(
    `SELECT * FROM payments WHERE repair_id = ?`,
  ).bind(id).first<any>();

  const overdue = isOverdue({ status: row.status, targetCompletionDate: row.target_completion_date });

  return c.json({
    data: {
      id: row.id,
      carId: row.car_id,
      appointmentId: row.appointment_id,
      createdById: row.created_by,
      primaryMechanicId: row.primary_mechanic_id,
      status: row.status,
      priority: row.priority,
      description: row.description,
      internalNotes: row.internal_notes,
      diagnosisReport: row.diagnosis_report ? JSON.parse(row.diagnosis_report) : null,
      diagnosisShared: row.diagnosis_shared === '1',
      clientApprovalStatus: row.client_approval_status,
      clientApprovalBypassReason: row.client_approval_bypass_reason,
      estimatedDurationHours: row.estimated_duration_hours ? parseFloat(row.estimated_duration_hours) : null,
      estimatedCost: row.estimated_cost ? parseFloat(row.estimated_cost) : null,
      partsTotal: parseFloat(row.parts_total ?? '0'),
      laborTotal: parseFloat(row.labor_total ?? '0'),
      discountAmount: parseFloat(row.discount_amount ?? '0'),
      finalTotal: parseFloat(row.final_total ?? '0'),
      targetCompletionDate: row.target_completion_date,
      actualCompletionDate: row.actual_completion_date,
      cancellationReason: row.cancellation_reason,
      reopenedReason: row.reopened_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOverdue: overdue,
      hasDelayReport: (delayReports.results?.length ?? 0) > 0,
      car: car ? {
        id: car.id, matricule: car.matricule, make: car.make, model: car.model,
        year: car.year, color: car.color,
        client: car.cl_id ? { id: car.cl_id, name: car.cl_name, phone: car.cl_phone } : null,
      } : null,
      appointment: appointment ? { id: appointment.id, status: appointment.status, purpose: appointment.purpose } : null,
      createdBy: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
      primaryMechanic: primaryMechanic ? { id: primaryMechanic.id, name: primaryMechanic.name, specialty: primaryMechanic.specialty } : null,
      mechanics: (mechanics.results ?? []).map((m: any) => ({
        repairId: m.repair_id, mechanicId: m.mechanic_id, isPrimary: m.is_primary === '1',
        mechanic: { id: m.id, name: m.name, specialty: m.specialty },
      })),
      statusLogs: (statusLogs.results ?? []).map((l: any) => ({
        id: l.id, repairId: l.repair_id, fromStatus: l.from_status, toStatus: l.to_status,
        note: l.note, createdAt: l.created_at,
        changedBy: { id: l.changed_by, name: l.changed_by_name },
      })),
      workLogs: (workLogs.results ?? []).map((l: any) => ({
        id: l.id, repairId: l.repair_id, mechanicId: l.mechanic_id,
        description: l.description, hoursSpent: parseFloat(l.hours_spent),
        loggedAt: l.logged_at,
        mechanic: { id: l.mechanic_id, name: l.mechanic_name },
      })),
      delayReports: (delayReports.results ?? []).map((d: any) => ({
        id: d.id, repairId: d.repair_id, reason: d.reason, evidenceNote: d.evidence_note, createdAt: d.created_at,
        reportedBy: { id: d.reported_by, name: d.reported_by_name },
      })),
      parts: (parts.results ?? []).map((p: any) => ({
        id: p.id, repairId: p.repair_id, partId: p.part_id, quantityUsed: parseInt(p.quantity_used),
        unitCostAtTime: parseFloat(p.unit_cost_at_time), stockOverride: p.stock_override === '1',
        addedAt: p.added_at,
        part: { id: p.part_id, name: p.part_name, reference: p.part_reference, category: p.part_category },
      })),
      laborItems: (laborItems.results ?? []).map((l: any) => ({
        id: l.id, repairId: l.repair_id, description: l.description,
        cost: parseFloat(l.cost), addedAt: l.added_at,
      })),
      payment: payment ? {
        id: payment.id, invoiceNumber: payment.invoice_number, finalTotal: parseFloat(payment.final_total),
        amountReceived: parseFloat(payment.amount_received), createdAt: payment.created_at,
      } : null,
    },
  });
});

// PATCH /repairs/:id
repairs.patch('/:id', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const setClauses: string[] = [];
  const params: any[] = [];
  const fieldMap: Record<string, string> = {
    description: 'description', internalNotes: 'internal_notes', priority: 'priority',
    estimatedDurationHours: 'estimated_duration_hours', estimatedCost: 'estimated_cost',
    targetCompletionDate: 'target_completion_date',
  };

  for (const [key, value] of Object.entries(body)) {
    const col = fieldMap[key];
    if (col && value !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(value === null ? null : String(value));
    }
  }

  if (setClauses.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE repair_jobs SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  return c.json({ data: { id, ...body } });
});

// PATCH /repairs/:id/status
repairs.patch('/:id/status', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as {
    status: string; note?: string; reopenedReason?: string; cancellationReason?: string;
  };

  const repair = await c.env.DB.prepare(
    `SELECT * FROM repair_jobs WHERE id = ?`,
  ).bind(id).first<any>();
  if (!repair) throw Errors.NotFound('Repair', id);

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  if (TERMINAL_STATUSES.includes(repair.status)) {
    throw Errors.BusinessRule('TERMINAL_STATE', `Repair is in terminal state: ${repair.status}`);
  }

  if (!isTransitionAllowed(repair.status, body.status)) {
    throw Errors.BusinessRule('INVALID_TRANSITION', `Cannot transition from '${repair.status}' to '${body.status}'`);
  }

  if (isOverdue(repair)) {
    const delayCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM delay_reports WHERE repair_id = ?`,
    ).bind(id).first<{ cnt: number }>();
    if ((delayCount?.cnt ?? 0) === 0) {
      throw Errors.BusinessRule('DELAY_REPORT_REQUIRED', 'This repair is overdue. Please file a delay report first.');
    }
  }

  if (body.status === 'in_progress') {
    const mechCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM repair_mechanics WHERE repair_id = ?`,
    ).bind(id).first<{ cnt: number }>();
    if ((mechCount?.cnt ?? 0) === 0) {
      throw Errors.BusinessRule('NO_MECHANIC', 'Assign a mechanic before starting the repair');
    }
  }

  if (repair.status === 'complete' && body.status === 'in_progress') {
    if (user.role !== 'manager') throw Errors.Forbidden('Only a manager can reopen a completed repair');
    if (!body.reopenedReason) throw Errors.BusinessRule('REOPEN_REASON_REQUIRED', 'A reason is required to reopen a completed repair');
  }

  if (body.status === 'delivered') {
    const payment = await c.env.DB.prepare(
      `SELECT id FROM payments WHERE repair_id = ?`,
    ).bind(id).first();
    if (!payment) throw Errors.BusinessRule('PAYMENT_REQUIRED', 'Register payment before marking as delivered');
  }

  if (body.status === 'cancelled' && !body.cancellationReason) {
    throw Errors.BusinessRule('CANCELLATION_REASON_REQUIRED', 'A reason is required to cancel a repair');
  }

  const updateData: Record<string, string | null> = { status: body.status };
  if (body.status === 'complete') updateData.actual_completion_date = new Date().toISOString();
  if (body.status === 'cancelled') updateData.cancellation_reason = body.cancellationReason ?? null;
  if (body.status === 'in_progress' && repair.status === 'complete') updateData.reopened_reason = body.reopenedReason ?? null;

  const setClauses = Object.entries(updateData)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`).join(', ');
  const updateParams = Object.values(updateData).filter((v) => v !== undefined);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE repair_jobs SET ${setClauses} WHERE id = ?`).bind(...updateParams, id),
    c.env.DB.prepare(
      `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), id, repair.status, body.status, user.sub, body.note ?? null),
  ]);

  const updated = await c.env.DB.prepare(
    `SELECT * FROM repair_jobs WHERE id = ?`,
  ).bind(id).first<any>();

  return c.json({ data: { ...updated, isOverdue: isOverdue(updated) } });
});

// PATCH /repairs/:id/assign
repairs.patch('/:id/assign', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as { primaryMechanicId: string; secondaryMechanicIds?: string[] };

  if (!body.primaryMechanicId) throw Errors.BadRequest('primaryMechanicId is required');

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(`DELETE FROM repair_mechanics WHERE repair_id = ?`).bind(id),
    c.env.DB.prepare(
      `INSERT INTO repair_mechanics (repair_id, mechanic_id, is_primary) VALUES (?, ?, '1')`,
    ).bind(id, body.primaryMechanicId),
    c.env.DB.prepare(`UPDATE repair_jobs SET primary_mechanic_id = ? WHERE id = ?`).bind(body.primaryMechanicId, id),
  ];

  for (const mid of body.secondaryMechanicIds ?? []) {
    stmts.push(c.env.DB.prepare(
      `INSERT INTO repair_mechanics (repair_id, mechanic_id, is_primary) VALUES (?, ?, '0')`,
    ).bind(id, mid));
  }

  await c.env.DB.batch(stmts as any);

  const mechanics = await c.env.DB.prepare(
    `SELECT rm.*, u.id as u_id, u.name as u_name, u.specialty
     FROM repair_mechanics rm LEFT JOIN users u ON u.id = rm.mechanic_id WHERE rm.repair_id = ?`,
  ).bind(id).all();

  return c.json({ data: { id, primaryMechanicId: body.primaryMechanicId, mechanics: mechanics.results } });
});

// POST /repairs/:id/diagnosis
repairs.post('/:id/diagnosis', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(`SELECT id, estimated_duration_hours FROM repair_jobs WHERE id = ?`).bind(id).first<any>();
  if (!existing) throw Errors.NotFound('Repair', id);

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  await c.env.DB.prepare(
    `UPDATE repair_jobs SET diagnosis_report = ?, estimated_duration_hours = COALESCE(?, estimated_duration_hours) WHERE id = ?`,
  ).bind(JSON.stringify(body), body.estimatedDurationHours != null ? String(body.estimatedDurationHours) : null, id).run();

  return c.json({ data: { id, diagnosisReport: body } });
});

// PATCH /repairs/:id/share-diagnosis
repairs.patch('/:id/share-diagnosis', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  const repair = await c.env.DB.prepare(`SELECT id, status FROM repair_jobs WHERE id = ?`).bind(id).first<any>();
  if (!repair) throw Errors.NotFound('Repair', id);

  const statusChanging = repair.status === 'diagnosing';

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare(`UPDATE repair_jobs SET diagnosis_shared = '1'${statusChanging ? ", status = 'awaiting_approval'" : ''} WHERE id = ?`).bind(id),
  ];

  if (statusChanging) {
    stmts.push(c.env.DB.prepare(
      `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by, note)
       VALUES (?, ?, ?, 'awaiting_approval', ?, 'Diagnosis shared with client')`,
    ).bind(crypto.randomUUID(), id, repair.status, user.sub));
  }

  await c.env.DB.batch(stmts as any);
  return c.json({ data: { id, diagnosisShared: true } });
});

// PATCH /repairs/:id/client-approval
repairs.patch('/:id/client-approval', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as {
    status: string; bypassReason?: string; cancellationReason?: string;
  };

  const repair = await c.env.DB.prepare(`SELECT id, status FROM repair_jobs WHERE id = ?`).bind(id).first<any>();
  if (!repair) throw Errors.NotFound('Repair', id);

  if (body.status === 'approved') {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE repair_jobs SET client_approval_status = 'approved', status = 'in_progress' WHERE id = ?`,
      ).bind(id),
      c.env.DB.prepare(
        `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, ?, 'in_progress', ?, 'Client approved diagnosis')`,
      ).bind(crypto.randomUUID(), id, repair.status, user.sub),
    ]);
    return c.json({ data: { id, clientApprovalStatus: 'approved', status: 'in_progress' } });
  }

  if (body.status === 'rejected') {
    const reason = body.cancellationReason ?? 'Client rejected diagnosis';
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE repair_jobs SET client_approval_status = 'rejected', status = 'cancelled', cancellation_reason = ? WHERE id = ?`,
      ).bind(reason, id),
      c.env.DB.prepare(
        `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, ?, 'cancelled', ?, ?)`,
      ).bind(crypto.randomUUID(), id, repair.status, user.sub, reason),
    ]);
    return c.json({ data: { id, clientApprovalStatus: 'rejected' } });
  }

  if (body.status === 'bypassed') {
    if (!body.bypassReason) throw Errors.BusinessRule('BYPASS_REASON_REQUIRED', 'A bypass reason is required');
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE repair_jobs SET client_approval_status = 'bypassed', client_approval_bypass_reason = ?, status = 'in_progress' WHERE id = ?`,
      ).bind(body.bypassReason, id),
      c.env.DB.prepare(
        `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by, note)
         VALUES (?, ?, ?, 'in_progress', ?, ?)`,
      ).bind(crypto.randomUUID(), id, repair.status, user.sub, `Client approval bypassed: ${body.bypassReason}`),
    ]);
    return c.json({ data: { id, clientApprovalStatus: 'bypassed' } });
  }

  throw Errors.BadRequest(`Invalid approval status: ${body.status}`);
});

// POST /repairs/:id/work-logs
repairs.post('/:id/work-logs', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { description: string; hoursSpent: number };

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  const logId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO repair_work_logs (id, repair_id, mechanic_id, description, hours_spent)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(logId, id, user.sub, body.description, String(body.hoursSpent)).run();

  return c.json({ data: { id: logId, repairId: id, mechanicId: user.sub, ...body } }, 201);
});

// GET /repairs/:id/work-logs
repairs.get('/:id/work-logs', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM repair_work_logs WHERE repair_id = ?`,
  ).bind(id).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT wl.*, u.name as mechanic_name FROM repair_work_logs wl
     LEFT JOIN users u ON u.id = wl.mechanic_id
     WHERE wl.repair_id = ?
     ORDER BY wl.logged_at DESC LIMIT ? OFFSET ?`,
  ).bind(id, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id, repairId: r.repair_id, mechanicId: r.mechanic_id,
    description: r.description, hoursSpent: parseFloat(r.hours_spent),
    loggedAt: r.logged_at, mechanic: { id: r.mechanic_id, name: r.mechanic_name },
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

// GET /repairs/:id/status-logs
repairs.get('/:id/status-logs', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const rows = await c.env.DB.prepare(
    `SELECT sl.*, u.name as changed_by_name FROM repair_status_logs sl
     LEFT JOIN users u ON u.id = sl.changed_by
     WHERE sl.repair_id = ? ORDER BY sl.created_at ASC`,
  ).bind(id).all();

  return c.json({ data: rows.results ?? [] });
});

// POST /repairs/:id/delay-report
repairs.post('/:id/delay-report', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { reason: string; evidenceNote?: string };

  const repair = await c.env.DB.prepare(
    `SELECT status, target_completion_date FROM repair_jobs WHERE id = ?`,
  ).bind(id).first<any>();
  if (!repair) throw Errors.NotFound('Repair', id);

  if (!isOverdue(repair)) throw Errors.BusinessRule('NOT_OVERDUE', 'This repair is not overdue');

  const reportId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO delay_reports (id, repair_id, reported_by, reason, evidence_note) VALUES (?, ?, ?, ?, ?)`,
  ).bind(reportId, id, user.sub, body.reason, body.evidenceNote ?? null).run();

  return c.json({ data: { id: reportId, ...body } }, 201);
});

// POST /repairs/:id/parts
repairs.post('/:id/parts', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as {
    partId: string; quantityUsed: number; stockOverride?: boolean;
  };

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  const part = await c.env.DB.prepare(
    `SELECT id, unit_cost, quantity FROM parts WHERE id = ? AND deleted_at IS NULL`,
  ).bind(body.partId).first<any>();
  if (!part) throw Errors.NotFound('Part', body.partId);

  const currentQty = parseInt(part.quantity ?? '0');
  if (currentQty < body.quantityUsed && !body.stockOverride) {
    throw Errors.BusinessRule('INSUFFICIENT_STOCK', `Only ${currentQty} units available. Use stockOverride to proceed.`);
  }

  const quantityAfter = currentQty - body.quantityUsed;
  const partRepairId = crypto.randomUUID();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO repair_parts (id, repair_id, part_id, quantity_used, unit_cost_at_time, stock_override, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(partRepairId, id, body.partId, String(body.quantityUsed), part.unit_cost,
      body.stockOverride ? '1' : '0', user.sub),
    c.env.DB.prepare(
      `UPDATE parts SET quantity = ? WHERE id = ?`,
    ).bind(String(quantityAfter), body.partId),
    c.env.DB.prepare(
      `INSERT INTO stock_transactions (id, part_id, type, quantity_change, quantity_after, repair_id, done_by, note)
       VALUES (?, ?, 'used', ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), body.partId, String(-body.quantityUsed), String(quantityAfter),
      id, user.sub, body.stockOverride ? `Stock override by manager for repair ${id}` : null),
  ]);

  await recalculateTotals(c.env.DB as any, id);

  return c.json({ data: { id: partRepairId, ...body } }, 201);
});

// DELETE /repairs/:id/parts/:repairPartId
repairs.delete('/:id/parts/:repairPartId', authorize(['manager']), async (c) => {
  const { id, repairPartId } = c.req.param();
  const user = c.get('user');

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const repairPart = await c.env.DB.prepare(
    `SELECT * FROM repair_parts WHERE id = ?`,
  ).bind(repairPartId).first<any>();
  if (!repairPart || repairPart.repair_id !== id) throw Errors.NotFound('RepairPart', repairPartId);

  const part = await c.env.DB.prepare(
    `SELECT quantity FROM parts WHERE id = ?`,
  ).bind(repairPart.part_id).first<any>();
  const quantityAfter = parseInt(part?.quantity ?? '0') + parseInt(repairPart.quantity_used);

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM repair_parts WHERE id = ?`).bind(repairPartId),
    c.env.DB.prepare(`UPDATE parts SET quantity = ? WHERE id = ?`).bind(String(quantityAfter), repairPart.part_id),
    c.env.DB.prepare(
      `INSERT INTO stock_transactions (id, part_id, type, quantity_change, quantity_after, repair_id, done_by, note)
       VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), repairPart.part_id, String(parseInt(repairPart.quantity_used)),
      String(quantityAfter), id, user.sub, `Part removed from repair ${id} — stock reversed`),
  ]);

  await recalculateTotals(c.env.DB as any, id);
  return c.json({ data: { message: 'Part removed from repair and stock restored' } });
});

// POST /repairs/:id/labor
repairs.post('/:id/labor', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { description: string; cost: number };

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  if (user.role === 'mechanic') {
    const assigned = await c.env.DB.prepare(
      `SELECT 1 FROM repair_mechanics WHERE repair_id = ? AND mechanic_id = ?`,
    ).bind(id, user.sub).first();
    if (!assigned) throw Errors.Forbidden('You are not assigned to this repair');
  }

  const laborId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO labor_items (id, repair_id, description, cost, added_by) VALUES (?, ?, ?, ?, ?)`,
  ).bind(laborId, id, body.description, String(body.cost), user.sub).run();

  await recalculateTotals(c.env.DB as any, id);
  return c.json({ data: { id: laborId, ...body } }, 201);
});

// PATCH /repairs/:id/labor/:itemId
repairs.patch('/:id/labor/:itemId', authorize(['manager']), async (c) => {
  const { id, itemId } = c.req.param();
  const body = await c.req.json() as { description?: string; cost?: number };

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const laborItem = await c.env.DB.prepare(
    `SELECT id, repair_id FROM labor_items WHERE id = ?`,
  ).bind(itemId).first<any>();
  if (!laborItem || laborItem.repair_id !== id) throw Errors.NotFound('LaborItem', itemId);

  const setClauses: string[] = [];
  const params: any[] = [];
  if (body.description !== undefined) { setClauses.push('description = ?'); params.push(body.description); }
  if (body.cost !== undefined) { setClauses.push('cost = ?'); params.push(String(body.cost)); }

  if (setClauses.length > 0) {
    params.push(itemId);
    await c.env.DB.prepare(`UPDATE labor_items SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();
    await recalculateTotals(c.env.DB as any, id);
  }

  return c.json({ data: { id: itemId, ...body } });
});

// DELETE /repairs/:id/labor/:itemId
repairs.delete('/:id/labor/:itemId', authorize(['manager']), async (c) => {
  const { id, itemId } = c.req.param();

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const laborItem = await c.env.DB.prepare(
    `SELECT id, repair_id FROM labor_items WHERE id = ?`,
  ).bind(itemId).first<any>();
  if (!laborItem || laborItem.repair_id !== id) throw Errors.NotFound('LaborItem', itemId);

  await c.env.DB.prepare(`DELETE FROM labor_items WHERE id = ?`).bind(itemId).run();
  await recalculateTotals(c.env.DB as any, id);

  return c.json({ data: { message: 'Labor item removed' } });
});

// GET /repairs/:id/mechanics
repairs.get('/:id/mechanics', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const rows = await c.env.DB.prepare(
    `SELECT rm.*, u.id as u_id, u.name as u_name, u.specialty, u.role, u.status
     FROM repair_mechanics rm LEFT JOIN users u ON u.id = rm.mechanic_id WHERE rm.repair_id = ?`,
  ).bind(id).all();

  return c.json({ data: rows.results ?? [] });
});

// POST /repairs/:id/notify
repairs.post('/:id/notify', authorize(['manager']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { template: 'T-03' | 'T-04'; notes?: string };

  const repair = await c.env.DB.prepare(
    `SELECT rj.*, c.make, c.model, c.matricule, c.client_id,
            u.name as client_name, u.phone as client_phone
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = c.client_id
     WHERE rj.id = ?`,
  ).bind(id).first<any>();

  if (!repair) throw Errors.NotFound('Repair', id);
  if (!repair.client_phone) throw Errors.BadRequest('No client associated with this repair');

  let waUrl = '';
  let messagePreview = '';

  if (body.template === 'T-03') {
    const issues = repair.diagnosis_report ? (JSON.parse(repair.diagnosis_report)?.issues || []) : [];
    const recommendations = repair.diagnosis_report
      ? (JSON.parse(repair.diagnosis_report)?.recommendedRepairs || 'Aucune recommandation')
      : 'Aucune recommandation';

    const issuesText = issues.length > 0
      ? issues.map((issue: any) => `• ${issue.description} (${issue.severity})`).join('\n')
      : 'Diagnostic en cours';

    const message = `Bonjour ${repair.client_name},\n\nLe diagnostic de votre véhicule est terminé.\n\n🚗 Véhicule : ${repair.make} ${repair.model} — ${repair.matricule}\n\n🔍 DIAGNOSTIC :\n${issuesText}\n\n💡 RECOMMANDATIONS :\n${recommendations}\n\n${body.notes ? `📝 NOTES :\n${body.notes}\n\n` : ''}Pour toute question, contactez-nous.\n\nGarage Sagman`;

    waUrl = `https://wa.me/${repair.client_phone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
    messagePreview = message.slice(0, 200);
  } else if (body.template === 'T-04' && repair.status === 'complete') {
    const message = `Bonjour ${repair.client_name},\n\nBonne nouvelle ! Votre véhicule est prêt pour la récupération.\n\n🚗 Véhicule : ${repair.make} ${repair.model} — ${repair.matricule}\n✅ Réparation terminée\n📅 Disponible dès maintenant\n\n${body.notes ? `📝 INFORMATIONS :\n${body.notes}\n\n` : ''}Nos horaires : Lun-Sam 8h-18h\nContact : +212 5XX XXX XXX\n\nGarage Sagman`;

    waUrl = `https://wa.me/${repair.client_phone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
    messagePreview = message.slice(0, 200);
  } else {
    throw Errors.BadRequest('Invalid template or repair status for this notification');
  }

  await c.env.DB.prepare(
    `INSERT INTO notification_logs (id, type, recipient_phone, sent_by, message_preview, repair_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), body.template, repair.client_phone, user.sub, messagePreview, id).run();

  return c.json({ data: { waUrl, messagePreview } });
});

// ── Photo Routes ──────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// POST /repairs/:id/photos/presign
repairs.post('/:id/photos/presign', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { fileName: string; mimeType: string; type: 'before' | 'during' | 'after' };

  if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
    throw Errors.BadRequest(`Unsupported file type: ${body.mimeType}`);
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const key = `repairs/${id}/${crypto.randomUUID()}-${body.fileName}`;

  const uploadUrl = await c.env.UPLOADS.createSignedUrl(key, {
    method: 'PUT', expiresIn: 3600,
    httpMetadata: { contentType: body.mimeType },
  });

  return c.json({ data: { uploadUrl, key, repairId: id } });
});

// POST /repairs/:id/photos — Save metadata after upload
repairs.post('/:id/photos', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { key: string; type: 'before' | 'during' | 'after'; mimeType?: string; sizeBytes?: number };

  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const photoId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO repair_photos (id, repair_id, uploaded_by, type, file_path, r2_key, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(photoId, id, user.sub, body.type, body.key, body.key, body.mimeType ?? null, body.sizeBytes != null ? String(body.sizeBytes) : null).run();

  return c.json({ data: { id: photoId, repairId: id, key: body.key, type: body.type } }, 201);
});

// GET /repairs/:id/photos
repairs.get('/:id/photos', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const existing = await c.env.DB.prepare(`SELECT id FROM repair_jobs WHERE id = ?`).bind(id).first();
  if (!existing) throw Errors.NotFound('Repair', id);

  const rows = await c.env.DB.prepare(
    `SELECT rp.*, u.name as uploader_name FROM repair_photos rp
     LEFT JOIN users u ON u.id = rp.uploaded_by WHERE rp.repair_id = ? ORDER BY rp.created_at DESC`,
  ).bind(id).all<any>();

  return c.json({
    data: (rows.results ?? []).map((r: any) => ({
      id: r.id, repairId: r.repair_id, type: r.type, filePath: r.file_path,
      r2Key: r.r2_key, mimeType: r.mime_type,
      sizeBytes: r.size_bytes ? parseInt(r.size_bytes) : null,
      createdAt: r.created_at,
      uploadedBy: { id: r.uploaded_by, name: r.uploader_name },
    })),
  });
});

// GET /repairs/:id/photos/:photoId/url
repairs.get('/:id/photos/:photoId/url', authorize(['manager', 'mechanic']), async (c) => {
  const { id, photoId } = c.req.param();
  const photo = await c.env.DB.prepare(`SELECT * FROM repair_photos WHERE id = ? AND repair_id = ?`).bind(photoId, id).first<any>();
  if (!photo) throw Errors.NotFound('Photo', photoId);

  const readUrl = await c.env.UPLOADS.createSignedUrl(photo.r2_key ?? photo.file_path, { method: 'GET', expiresIn: 3600 });
  return c.json({ data: { url: readUrl, key: photo.r2_key ?? photo.file_path } });
});

// DELETE /repairs/:id/photos/:photoId
repairs.delete('/:id/photos/:photoId', authorize(['manager']), async (c) => {
  const { id, photoId } = c.req.param();
  const photo = await c.env.DB.prepare(`SELECT * FROM repair_photos WHERE id = ? AND repair_id = ?`).bind(photoId, id).first<any>();
  if (!photo) throw Errors.NotFound('Photo', photoId);

  await Promise.all([
    c.env.UPLOADS.delete(photo.r2_key ?? photo.file_path),
    c.env.DB.prepare(`DELETE FROM repair_photos WHERE id = ?`).bind(photoId).run(),
  ]);

  return c.json({ data: { message: 'Photo deleted' } });
});

export { repairs };
