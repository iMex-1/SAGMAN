import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authenticateClient } from '../../middleware/auth';

const portal = new Hono<AppBindings>();

// Public routes (no auth required)
// GET /portal/reviews — public, visible reviews only
portal.get('/reviews', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, client_name, rating, comment, created_at FROM reviews WHERE is_visible = 1 ORDER BY created_at DESC LIMIT 50`,
  ).all<any>();
  return c.json({ data: rows.results });
});

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

  const [cars, allRepairs] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, matricule, make, model, year, color FROM cars WHERE client_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    ).bind(user.sub).all<any>(),
    c.env.DB.prepare(
      `SELECT rj.id, rj.car_id, rj.status, rj.priority, rj.description, rj.target_completion_date, rj.created_at, u.name as mech_name
       FROM repair_jobs rj
       LEFT JOIN users u ON u.id = rj.primary_mechanic_id
       WHERE rj.car_id IN (SELECT id FROM cars WHERE client_id = ? AND deleted_at IS NULL)
       ORDER BY rj.created_at DESC`,
    ).bind(user.sub).all<any>(),
  ]);

  const activeByCar: Record<string, any> = {};
  const pastByCar: Record<string, any[]> = {};

  for (const r of allRepairs.results ?? []) {
    if (!['delivered', 'cancelled'].includes(r.status)) {
      if (!activeByCar[r.car_id]) {
        activeByCar[r.car_id] = {
          id: r.id, status: r.status, priority: r.priority,
          description: r.description, targetCompletionDate: r.target_completion_date,
          createdAt: r.created_at,
          isOverdue: isOverdue({ status: r.status, targetCompletionDate: r.target_completion_date }),
          mechanicName: r.mech_name,
        };
      }
    } else {
      if (!pastByCar[r.car_id]) pastByCar[r.car_id] = [];
      pastByCar[r.car_id].push({
        id: r.id, status: r.status, priority: r.priority,
        description: r.description, targetCompletionDate: r.target_completion_date,
        createdAt: r.created_at,
        mechanicName: r.mech_name,
      });
    }
  }

  const data = (cars.results ?? []).map((car: any) => ({
    id: car.id, matricule: car.matricule, make: car.make, model: car.model, year: car.year, color: car.color,
    activeRepair: activeByCar[car.id] ?? null,
    pastRepairs: pastByCar[car.id] ?? [],
  }));

  return c.json({ data });
});

// GET /portal/cars/:id
portal.get('/cars/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  const car = await c.env.DB.prepare(
    `SELECT id, matricule, make, model, year, color, created_at
     FROM cars WHERE id = ? AND client_id = ? AND deleted_at IS NULL`,
  ).bind(id, user.sub).first<any>();

  if (!car) throw Errors.NotFound('Car', id);

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.status, rj.priority, rj.description, rj.target_completion_date, rj.actual_completion_date, rj.created_at,
            u.name as mech_name
     FROM repair_jobs rj
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     WHERE rj.car_id = ?
     ORDER BY rj.created_at DESC`,
  ).bind(id).all<any>();

  const activeRepairs: any[] = [];
  const pastRepairs: any[] = [];

  for (const r of repairs.results ?? []) {
    const item = {
      id: r.id, status: r.status, priority: r.priority, description: r.description,
      targetCompletionDate: r.target_completion_date, actualCompletionDate: r.actual_completion_date,
      createdAt: r.created_at, isOverdue: isOverdue(r), mechanicName: r.mech_name,
    };
    if (!['delivered', 'cancelled'].includes(r.status)) {
      activeRepairs.push(item);
    } else {
      pastRepairs.push(item);
    }
  }

  return c.json({
    data: {
      id: car.id, matricule: car.matricule, make: car.make, model: car.model,
      year: car.year, color: car.color, createdAt: car.created_at,
      activeRepairs, pastRepairs,
    },
  });
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

  const appointmentCarImage = repair.appointment_id
    ? await c.env.DB.prepare(
        `SELECT car_image_url FROM appointments WHERE id = ?`,
      ).bind(repair.appointment_id).first<{ car_image_url: string | null }>()
    : null;

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
      carImageUrl: appointmentCarImage?.car_image_url ?? null,
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
    `SELECT id, client_id, client_name, client_phone, car_id, car_matricule, purpose, requested_at, status, notes, created_at, car_image_url
     FROM appointments WHERE client_id = ? AND deleted_at IS NULL ORDER BY requested_at DESC LIMIT 10`,
  ).bind(user.sub).all();
  return c.json({ data: rows.results ?? [] });
});

// POST /portal/upload-car-image
portal.post('/upload-car-image', async (c) => {
  const body = await c.req.json() as { image: string; mimeType?: string };
  if (!body.image) throw Errors.BadRequest('Image data is required');

  const base64 = body.image.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  let buffer: Uint8Array;
  try {
    buffer = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  } catch {
    throw Errors.BadRequest('Invalid image data');
  }

  const mimeType = body.mimeType ?? 'image/jpeg';
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `appointment-cars/${crypto.randomUUID()}.${ext}`;

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${key}`;
  return c.json({ url, key });
});

// POST /portal/appointments
portal.post('/appointments', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as {
    carId?: string; carMatricule?: string; carMake?: string; carModel?: string; carYear?: string; carColor?: string;
    purpose: string; requestedAt: string; notes?: string; carImageUrl?: string;
  };

  const client = await c.env.DB.prepare(`SELECT id, name, phone FROM users WHERE id = ?`).bind(user.sub).first<any>();
  if (!client) throw Errors.NotFound('Client');
  if (!body.purpose || body.purpose.length < 5) throw Errors.ValidationError('Purpose must be at least 5 characters');

  const defaultManager = await c.env.DB.prepare(
    `SELECT id FROM users WHERE role = 'manager' AND status = 'active' LIMIT 1`,
  ).first<{ id: string }>();
  if (!defaultManager) throw Errors.BadRequest('No active manager found in system');

  const appointmentId = crypto.randomUUID();
  const carId = body.carId ?? null;

  await c.env.DB.prepare(
    `INSERT INTO appointments (id, client_id, client_name, client_phone, car_id, car_matricule, car_make, car_model, car_year, car_color, purpose, requested_at, status, created_by, notes, car_image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).bind(appointmentId, user.sub, client.name, client.phone ?? '', carId,
    body.carMatricule?.toUpperCase() ?? null, body.carMake ?? null, body.carModel ?? null, body.carYear ?? null, body.carColor ?? null,
    body.purpose, body.requestedAt,
    defaultManager.id, body.notes ?? null, body.carImageUrl ?? null).run();

  return c.json({ data: { id: appointmentId, carId, ...body } }, 201);
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

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${row.r2_key ?? row.file_path}`;
  return c.json({ data: { url, key: row.r2_key ?? row.file_path } });
});

// POST /portal/reviews
portal.post('/reviews', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as { rating: number; comment?: string };

  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    throw Errors.ValidationError('Rating must be an integer between 1 and 5');
  }

  const client = await c.env.DB.prepare(
    `SELECT id, name FROM users WHERE id = ?`,
  ).bind(user.sub).first<any>();
  if (!client) throw Errors.NotFound('Client');

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO reviews (id, client_id, client_name, rating, comment) VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, user.sub, client.name, String(body.rating), body.comment ?? null).run();

  return c.json({ data: { id, rating: body.rating, comment: body.comment ?? null, clientName: client.name } }, 201);
});

export { portal };
