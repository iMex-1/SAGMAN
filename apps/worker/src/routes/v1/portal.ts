import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authenticateClient } from '../../middleware/auth';

const portal = new Hono<AppBindings>();
portal.use('/*', authenticateClient);

function isOverdue(repair: { status: string; targetCompletionDate: string | null }): boolean {
  if (!repair.targetCompletionDate) return false;
  if (['complete', 'delivered', 'cancelled'].includes(repair.status)) return false;
  return new Date() > new Date(repair.targetCompletionDate);
}

// GET /portal/me
portal.get('/me', async (c) => {
  const user = c.get('user');
  const client = await c.env.DB.prepare(
    `SELECT id, name, phone, created_at FROM users WHERE id = ?`,
  ).bind(user.sub).first<any>();
  if (!client) throw Errors.NotFound('Client');
  return c.json({ data: { id: client.id, name: client.name, phone: client.phone, createdAt: client.created_at } });
});

// GET /portal/cars
portal.get('/cars', async (c) => {
  const user = c.get('user');
  const cars = await c.env.DB.prepare(
    `SELECT c.id, c.matricule, c.make, c.model, c.year, c.color,
            rj.id as rj_id, rj.status as rj_status, rj.priority as rj_priority,
            rj.description as rj_description, rj.target_completion_date as rj_target,
            rj.created_at as rj_created,
            u.name as mech_name
     FROM cars c
     LEFT JOIN repair_jobs rj ON rj.car_id = c.id AND rj.status NOT IN ('delivered', 'cancelled')
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     WHERE c.client_id = ? AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC`,
  ).bind(user.sub).all<any>();

  const grouped: Record<string, any> = {};
  for (const r of cars.results ?? []) {
    if (!grouped[r.id]) {
      grouped[r.id] = {
        id: r.id, matricule: r.matricule, make: r.make, model: r.model, year: r.year, color: r.color,
        activeRepair: null,
      };
    }
    if (r.rj_id && !grouped[r.id].activeRepair) {
      grouped[r.id].activeRepair = {
        id: r.rj_id, status: r.rj_status, priority: r.rj_priority,
        description: r.rj_description, targetCompletionDate: r.rj_target,
        createdAt: r.rj_created, isOverdue: isOverdue({ status: r.rj_status, targetCompletionDate: r.rj_target }),
        mechanicName: r.mech_name,
      };
    }
  }

  return c.json({ data: Object.values(grouped) });
});

// GET /portal/repairs/:id
portal.get('/repairs/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  const repair = await c.env.DB.prepare(
    `SELECT rj.*, c.id as c_id, c.matricule, c.make, c.model, c.year, c.color, c.client_id,
            mech.name as mech_name,
            pm.invoice_number, pm.final_total as pm_total, pm.created_at as pm_created
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users mech ON mech.id = rj.primary_mechanic_id
     LEFT JOIN payments pm ON pm.repair_id = rj.id
     WHERE rj.id = ?`,
  ).bind(id).first<any>();

  if (!repair) throw Errors.NotFound('Repair', id);
  if (repair.client_id !== user.sub) throw Errors.Forbidden('You do not have access to this repair');

  const statusLogs = await c.env.DB.prepare(
    `SELECT sl.*, u.name as changed_by_name FROM repair_status_logs sl
     LEFT JOIN users u ON u.id = sl.changed_by WHERE sl.repair_id = ? ORDER BY sl.created_at ASC`,
  ).bind(id).all();

  const parts = await c.env.DB.prepare(
    `SELECT rp.*, p.name as pname, p.reference as pref FROM repair_parts rp
     LEFT JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = ?`,
  ).bind(id).all();

  const laborItems = await c.env.DB.prepare(
    `SELECT * FROM labor_items WHERE repair_id = ?`,
  ).bind(id).all();

  const delayReports = await c.env.DB.prepare(
    `SELECT id FROM delay_reports WHERE repair_id = ?`,
  ).bind(id).all();

  const photos = await c.env.DB.prepare(
    `SELECT id, type, file_path, r2_key, mime_type, size_bytes, created_at, uploaded_by
     FROM repair_photos WHERE repair_id = ? ORDER BY created_at DESC`,
  ).bind(id).all<any>();

  return c.json({
    data: {
      id: repair.id,
      status: repair.status,
      priority: repair.priority,
      description: repair.description,
      isOverdue: isOverdue(repair),
      diagnosisShared: repair.diagnosis_shared === '1',
      diagnosisReport: repair.diagnosis_shared === '1' && repair.diagnosis_report ? JSON.parse(repair.diagnosis_report) : null,
      estimatedCost: repair.estimated_cost ? parseFloat(repair.estimated_cost) : null,
      finalTotal: parseFloat(repair.final_total ?? '0'),
      targetCompletionDate: repair.target_completion_date,
      actualCompletionDate: repair.actual_completion_date,
      createdAt: repair.created_at,
      car: { id: repair.c_id, matricule: repair.matricule, make: repair.make, model: repair.model, year: repair.year, color: repair.color },
      primaryMechanic: { name: repair.mech_name },
      statusLogs: (statusLogs.results ?? []).map((l: any) => ({ id: l.id, fromStatus: l.from_status, toStatus: l.to_status, note: l.note, createdAt: l.created_at, changedBy: { name: l.changed_by_name } })),
      payment: repair.invoice_number ? { invoiceNumber: repair.invoice_number, finalTotal: parseFloat(repair.pm_total ?? '0'), createdAt: repair.pm_created } : null,
      hasDelayReport: (delayReports.results?.length ?? 0) > 0,
      photos: (photos.results ?? []).map((p: any) => ({
        id: p.id, type: p.type, r2Key: p.r2_key ?? p.file_path,
        mimeType: p.mime_type, sizeBytes: p.size_bytes ? parseInt(p.size_bytes) : null,
        createdAt: p.created_at,
      })),
    },
  });
});

// GET /portal/appointments
portal.get('/appointments', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT id, client_id, client_name, client_phone, car_id, car_matricule, purpose, requested_at, status, notes, created_at
     FROM appointments WHERE client_id = ? AND deleted_at IS NULL ORDER BY requested_at DESC LIMIT 10`,
  ).bind(user.sub).all();
  return c.json({ data: rows.results ?? [] });
});

// POST /portal/appointments
portal.post('/appointments', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as {
    carId?: string; carMatricule?: string; purpose: string; requestedAt: string; notes?: string;
  };

  const client = await c.env.DB.prepare(`SELECT id, name, phone FROM users WHERE id = ?`).bind(user.sub).first<any>();
  if (!client) throw Errors.NotFound('Client');
  if (!body.purpose || body.purpose.length < 5) throw Errors.ValidationError('Purpose must be at least 5 characters');

  const defaultManager = await c.env.DB.prepare(
    `SELECT id FROM users WHERE role = 'manager' AND status = 'active' LIMIT 1`,
  ).first<{ id: string }>();
  if (!defaultManager) throw Errors.BadRequest('No active manager found in system');

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO appointments (id, client_id, client_name, client_phone, car_id, car_matricule, purpose, requested_at, status, created_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(id, user.sub, client.name, client.phone ?? '', body.carId ?? null,
    body.carMatricule?.toUpperCase() ?? null, body.purpose, body.requestedAt,
    defaultManager.id, body.notes ?? null).run();

  return c.json({ data: { id, ...body } }, 201);
});

// GET /portal/repairs/:id/photos/:photoId/url
portal.get('/repairs/:id/photos/:photoId/url', async (c) => {
  const { id, photoId } = c.req.param();
  const user = c.get('user');

  const row = await c.env.DB.prepare(
    `SELECT rp.*, c.client_id FROM repair_photos rp
     JOIN repair_jobs rj ON rj.id = rp.repair_id
     JOIN cars c ON c.id = rj.car_id
     WHERE rp.id = ? AND rp.repair_id = ?`,
  ).bind(photoId, id).first<any>();
  if (!row) throw Errors.NotFound('Photo', photoId);
  if (row.client_id !== user.sub) throw Errors.Forbidden();

  const readUrl = await c.env.UPLOADS.createSignedUrl(row.r2_key ?? row.file_path, { method: 'GET', expiresIn: 3600 });
  return c.json({ data: { url: readUrl, key: row.r2_key ?? row.file_path } });
});

export { portal };
