import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';
import { normalizePhone } from '../../utils/phone';

const appointments = new Hono<AppBindings>();
appointments.use('/*', authenticate, authorize(['manager', 'overseer']));

const ACTIVE_STATUSES = ['received', 'diagnosing', 'awaiting_approval', 'in_progress', 'waiting_for_parts', 'complete'];

// GET /appointments
appointments.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  let whereSql = 'WHERE a.deleted_at IS NULL';
  const params: string[] = [];

  if (query.status) { whereSql += ' AND a.status = ?'; params.push(query.status); }

  if (query.date) {
    const d = new Date(query.date);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
    whereSql += ' AND a.requested_at >= ? AND a.requested_at < ?';
    params.push(dayStart, dayEnd);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM appointments a ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.client_id, a.client_name, a.client_phone, a.car_id, a.car_matricule,
            a.car_make, a.car_model, a.car_year, a.car_color, a.car_image_url,
            a.purpose, a.requested_at, a.confirmed_at, a.rescheduled_to,
            a.status, a.cancellation_reason, a.notes, a.created_at,
            u.name as client_name_val, u.phone as client_phone_val,
            c.id as car_id_val, c.matricule as car_matricule_val, c.make, c.model
     FROM appointments a
     LEFT JOIN users u ON u.id = a.client_id
     LEFT JOIN cars c ON c.id = a.car_id
     ${whereSql}
     ORDER BY a.requested_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    carId: r.car_id,
    carMatricule: r.car_matricule,
    carMake: r.car_make,
    carModel: r.car_model,
    carYear: r.car_year,
    carColor: r.car_color,
    carImageUrl: r.car_image_url,
    purpose: r.purpose,
    requestedAt: r.requested_at,
    confirmedAt: r.confirmed_at,
    rescheduledTo: r.rescheduled_to,
    status: r.status,
    cancellationReason: r.cancellation_reason,
    notes: r.notes,
    createdAt: r.created_at,
    client: r.client_id ? { id: r.client_id, name: r.client_name_val, phone: r.client_phone_val } : null,
    car: r.car_id_val ? { id: r.car_id_val, matricule: r.car_matricule_val, make: r.make, model: r.model } : null,
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

// POST /appointments
appointments.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as any;

  const clientPhone = normalizePhone(body.clientPhone);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO appointments (id, client_id, client_name, client_phone, car_id, car_matricule, car_make, car_model, car_year, car_color, purpose, requested_at, status, confirmed_at, created_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
  ).bind(
    id,
    body.clientId ?? null,
    body.clientName,
    clientPhone,
    body.carId ?? null,
    body.carMatricule ?? null,
    body.carMake ?? null,
    body.carModel ?? null,
    body.carYear ?? null,
    body.carColor ?? null,
    body.purpose,
    body.requestedAt,
    new Date().toISOString(),
    user.sub,
    body.notes ?? null,
  ).run();

  return c.json({
    data: { id, ...body, status: 'confirmed', confirmedAt: new Date().toISOString(), createdById: user.sub },
  }, 201);
});

// GET /appointments/:id
appointments.get('/:id', async (c) => {
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT a.*,
            u.id as u_id, u.name as u_name, u.email as u_email, u.phone as u_phone, u.role as u_role,
            c.id as c_id, c.matricule as c_matricule, c.make as c_make, c.model as c_model, c.year as c_year, c.color as c_color,
            creator.name as creator_name,
            rj.id as rj_id, rj.status as rj_status
     FROM appointments a
     LEFT JOIN users u ON u.id = a.client_id
     LEFT JOIN cars c ON c.id = a.car_id
     LEFT JOIN users creator ON creator.id = a.created_by
     LEFT JOIN repair_jobs rj ON rj.appointment_id = a.id
     WHERE a.id = ? AND a.deleted_at IS NULL`,
  ).bind(id).first<any>();

  if (!row) throw Errors.NotFound('Appointment', id);

  return c.json({
    data: {
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      clientPhone: row.client_phone,
      carId: row.car_id,
      carMatricule: row.car_matricule,
      carMake: row.car_make,
      carModel: row.car_model,
      carYear: row.car_year,
      carColor: row.car_color,
      carImageUrl: row.car_image_url,
      purpose: row.purpose,
      requestedAt: row.requested_at,
      confirmedAt: row.confirmed_at,
      rescheduledTo: row.rescheduled_to,
      status: row.status,
      cancellationReason: row.cancellation_reason,
      notes: row.notes,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      createdById: row.created_by,
      client: row.u_id ? { id: row.u_id, name: row.u_name, email: row.u_email, phone: row.u_phone, role: row.u_role } : null,
      car: row.c_id ? { id: row.c_id, matricule: row.c_matricule, make: row.c_make, model: row.c_model, year: row.c_year, color: row.c_color } : null,
      createdBy: { name: row.creator_name },
      repairJob: row.rj_id ? { id: row.rj_id, status: row.rj_status } : null,
    },
  });
});

// PATCH /appointments/:id
appointments.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; status: string }>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status === 'converted' || existing.status === 'cancelled') {
    throw Errors.BadRequest(`Cannot edit an appointment with status '${existing.status}'`, 'INVALID_STATUS_TRANSITION');
  }

  const setClauses: string[] = [];
  const params: any[] = [];
  for (const key of ['purpose', 'notes', 'carImageUrl']) {
    if (body[key] !== undefined) {
      const col = key === 'carImageUrl' ? 'car_image_url' : key;
      setClauses.push(`${col} = ?`); params.push(body[key]);
    }
  }
  if (body.requestedAt !== undefined) { setClauses.push('requested_at = ?'); params.push(body.requestedAt); }

  if (setClauses.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE appointments SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  return c.json({ data: { id, ...body } });
});

// PATCH /appointments/:id/confirm
appointments.patch('/:id/confirm', async (c) => {
  const { id } = c.req.param();
  const force = c.req.query('force') === 'true';

  const existing = await c.env.DB.prepare(
    `SELECT id, status, requested_at FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; status: string; requested_at: string }>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status !== 'pending' && existing.status !== 'rescheduled') {
    throw Errors.BadRequest(`Only pending or rescheduled appointments can be confirmed. Current status: '${existing.status}'`, 'INVALID_STATUS_TRANSITION');
  }

  if (!force) {
    const date = new Date(existing.requested_at);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

    const count = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM appointments WHERE status IN ('confirmed', 'rescheduled') AND requested_at >= ? AND requested_at < ? AND deleted_at IS NULL AND id != ?`,
    ).bind(dayStart, dayEnd, id).first<{ cnt: number }>();

    const settingRow = await c.env.DB.prepare(
      `SELECT value FROM system_settings WHERE key = 'max_concurrent_cars'`,
    ).first<{ value: string }>();
    const capacityLimit = settingRow ? parseInt(settingRow.value) : 5;

    if ((count?.cnt ?? 0) >= capacityLimit) {
      return c.json({
        data: { warning: 'Capacity limit reached', capacityLimit, currentCount: count?.cnt ?? 0 },
        requiresAcknowledgement: true,
      }, 200);
    }
  }

  await c.env.DB.prepare(
    `UPDATE appointments SET status = 'confirmed', confirmed_at = ? WHERE id = ?`,
  ).bind(new Date().toISOString(), id).run();

  return c.json({ data: { id, status: 'confirmed' } });
});

// PATCH /appointments/:id/reschedule
appointments.patch('/:id/reschedule', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as { rescheduledTo: string; notes?: string };

  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; status: string }>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status !== 'pending' && existing.status !== 'confirmed') {
    throw Errors.BadRequest(`Only pending or confirmed appointments can be rescheduled. Current status: '${existing.status}'`, 'INVALID_STATUS_TRANSITION');
  }

  await c.env.DB.prepare(
    `UPDATE appointments SET status = 'rescheduled', rescheduled_to = ?, notes = COALESCE(?, notes) WHERE id = ?`,
  ).bind(body.rescheduledTo, body.notes ?? null, id).run();

  return c.json({ data: { id, status: 'rescheduled', rescheduledTo: body.rescheduledTo } });
});

// PATCH /appointments/:id/cancel
appointments.patch('/:id/cancel', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as { cancellationReason: string };

  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; status: string }>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status === 'converted' || existing.status === 'cancelled') {
    throw Errors.BadRequest(`Cannot cancel an appointment with status '${existing.status}'`, 'INVALID_STATUS_TRANSITION');
  }

  await c.env.DB.prepare(
    `UPDATE appointments SET status = 'cancelled', cancellation_reason = ? WHERE id = ?`,
  ).bind(body.cancellationReason, id).run();

  return c.json({ data: { id, status: 'cancelled' } });
});

// POST /appointments/:id/convert
appointments.post('/:id/convert', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as {
    primaryMechanicId: string;
    priority?: string;
    description?: string;
    targetCompletionDate?: string;
  };

  const existing = await c.env.DB.prepare(
    `SELECT id, status, car_id, car_matricule, car_make, car_model, car_year, car_color, client_id, purpose FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<any>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status !== 'confirmed') {
    throw Errors.BadRequest(`Only confirmed appointments can be converted. Current status: '${existing.status}'`, 'INVALID_STATUS_TRANSITION');
  }

  const mechanic = await c.env.DB.prepare(
    `SELECT id, status FROM users WHERE id = ?`,
  ).bind(body.primaryMechanicId).first<{ id: string; status: string }>();
  if (!mechanic || mechanic.status !== 'active') {
    throw Errors.BadRequest('The assigned mechanic does not exist or is not active', 'INVALID_MECHANIC');
  }

  let carId = existing.car_id;
  if (!carId && existing.car_matricule) {
    const matricule = existing.car_matricule;
    const car = await c.env.DB.prepare(
      `SELECT id FROM cars WHERE matricule = ? AND deleted_at IS NULL`,
    ).bind(matricule).first<{ id: string }>();
    if (car) {
      carId = car.id;
    } else if (existing.car_make && existing.car_model) {
      carId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO cars (id, matricule, make, model, year, color, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(carId, matricule, existing.car_make, existing.car_model, existing.car_year ?? null, existing.car_color ?? null, existing.client_id).run();
    }
  }
  if (!carId) throw Errors.BadRequest('Cannot convert appointment: no car linked', 'CAR_NOT_RESOLVED');

  const activeRepair = await c.env.DB.prepare(
    `SELECT id FROM repair_jobs WHERE car_id = ? AND status NOT IN ('delivered', 'cancelled')`,
  ).bind(carId).first();
  if (activeRepair) {
    throw Errors.BusinessRule('CAR_HAS_ACTIVE_REPAIR', 'This car already has an active repair');
  }

  const repairId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO repair_jobs (id, car_id, appointment_id, created_by, primary_mechanic_id, status, priority, description, target_completion_date)
       VALUES (?, ?, ?, ?, ?, 'received', ?, ?, ?)`,
    ).bind(repairId, carId, id, user.sub, body.primaryMechanicId, body.priority ?? 'normal', body.description ?? existing.purpose, body.targetCompletionDate ?? null),
    c.env.DB.prepare(
      `INSERT INTO repair_mechanics (repair_id, mechanic_id, is_primary) VALUES (?, ?, '1')`,
    ).bind(repairId, body.primaryMechanicId),
    c.env.DB.prepare(
      `INSERT INTO repair_status_logs (id, repair_id, from_status, to_status, changed_by)
       VALUES (?, ?, NULL, 'received', ?)`,
    ).bind(crypto.randomUUID(), repairId, user.sub),
    c.env.DB.prepare(
      `UPDATE appointments SET status = 'converted' WHERE id = ?`,
    ).bind(id),
  ]);

  return c.json({ data: { repairId, appointmentId: id } }, 201);
});

// DELETE /appointments/:id
appointments.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM appointments WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; status: string }>();
  if (!existing) throw Errors.NotFound('Appointment', id);
  if (existing.status === 'converted') {
    throw Errors.BusinessRule('APPOINTMENT_CONVERTED', 'Cannot delete a converted appointment');
  }

  await c.env.DB.prepare(
    `UPDATE appointments SET deleted_at = ? WHERE id = ?`,
  ).bind(new Date().toISOString(), id).run();

  return c.json({ data: { message: 'Appointment deleted' } });
});

export { appointments };
