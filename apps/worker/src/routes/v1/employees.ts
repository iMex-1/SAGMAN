import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';
import { normalizePhone } from '../../utils/phone';

const employees = new Hono<AppBindings>();
employees.use('/*', authenticate, authorize(['manager', 'overseer']));

// GET /employees
employees.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 50,
  });

  let whereSql = "WHERE role NOT IN ('client') AND status != 'deleted'";
  const params: string[] = [];
  if (query.status) { whereSql += ' AND status = ?'; params.push(query.status); }
  if (query.role) { whereSql += ' AND role = ?'; params.push(query.role); }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM users ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, role, phone, specialty, cin, address, image_url, status, created_at
     FROM users ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  return c.json(paginate(rows.results ?? [], countRow?.total ?? 0, page, limit));
});

// POST /employees
employees.post('/', async (c) => {
  const body = await c.req.json() as any;

  if (!body.email) {
    body.email = body.cin
      ? `${body.cin}@sagman.ma`
      : `${crypto.randomUUID()}@sagman.ma`;
  }

  if (!body.password) {
    body.password = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ?`,
  ).bind(body.email).first();
  if (existing) throw Errors.Conflict(`An employee with email '${body.email}' already exists`);

  const passwordHash = await bcrypt.hash(body.password, 12);
  const id = crypto.randomUUID();

  const normalizedPhone = body.phone ? normalizePhone(body.phone) : null;
  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, phone, specialty, cin, address, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  ).bind(
    id, body.name, body.email, passwordHash, body.role,
    normalizedPhone, body.specialty ?? null,
    body.cin ?? null, body.address ?? null,
    body.imageUrl ?? null,
  ).run();

  return c.json({
    data: {
      id, name: body.name, email: body.email,
      role: body.role, phone: body.phone,
      specialty: body.specialty, cin: body.cin,
      address: body.address, imageUrl: body.imageUrl, status: 'active',
    },
  }, 201);
});

// GET /employees/:id
employees.get('/:id', async (c) => {
  const { id } = c.req.param();

  const user = await c.env.DB.prepare(
    `SELECT id, name, email, role, phone, specialty, cin, address, image_url, status, created_at
     FROM users WHERE id = ?`,
  ).bind(id).first<any>();
  if (!user) throw Errors.NotFound('Employee', id);

  const counts = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM repair_jobs WHERE primary_mechanic_id = ?) as primary_repairs,
       (SELECT COUNT(*) FROM repair_work_logs WHERE mechanic_id = ?) as work_logs`,
  ).bind(id, id).first<{ primary_repairs: number; work_logs: number }>();

  return c.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      specialty: user.specialty,
      cin: user.cin,
      address: user.address,
      imageUrl: user.image_url,
      status: user.status,
      createdAt: user.created_at,
      _count: {
        primaryRepairs: counts?.primary_repairs ?? 0,
        workLogs: counts?.work_logs ?? 0,
      },
    },
  });
});

// PATCH /employees/:id
employees.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(
    `SELECT id, email FROM users WHERE id = ?`,
  ).bind(id).first<{ id: string; email: string }>();
  if (!existing) throw Errors.NotFound('Employee', id);

  if (body.email && body.email !== existing.email) {
    const taken = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ? AND id != ?`,
    ).bind(body.email, id).first();
    if (taken) throw Errors.Conflict(`Email '${body.email}' is already in use`);
  }

  if (body.phone) body.phone = normalizePhone(body.phone);
  const setClauses: string[] = [];
  const params: any[] = [];
  for (const key of ['name', 'email', 'phone', 'specialty', 'role', 'cin', 'address', 'imageUrl']) {
    if (body[key] !== undefined) {
      const col = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
      setClauses.push(`${col} = ?`);
      params.push(body[key]);
    }
  }

  if (setClauses.length > 0) {
    params.push(id);
    await c.env.DB.prepare(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    ).bind(...params).run();
  }

  return c.json({
    data: {
      id, name: body.name, email: body.email,
      role: body.role, phone: body.phone,
      specialty: body.specialty, cin: body.cin,
      address: body.address, imageUrl: body.imageUrl, status: body.status,
    },
  });
});

// PATCH /employees/:id/deactivate
employees.patch('/:id/deactivate', async (c) => {
  const { id } = c.req.param();

  const user = await c.env.DB.prepare(
    `SELECT id, status, role FROM users WHERE id = ?`,
  ).bind(id).first<{ id: string; status: string; role: string }>();
  if (!user) throw Errors.NotFound('Employee', id);
  if (user.status === 'inactive') throw Errors.BadRequest('Employee is already inactive');

  if (user.role === 'manager') {
    const activeManagerCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM users WHERE role = 'manager' AND status = 'active'`,
    ).first<{ cnt: number }>();
    if ((activeManagerCount?.cnt ?? 0) <= 1) {
      throw Errors.BusinessRule(
        'LAST_MANAGER',
        'Cannot deactivate the last active Manager. Promote another employee first.',
      );
    }
  }

  await c.env.DB.prepare(
    `UPDATE users SET status = 'inactive' WHERE id = ?`,
  ).bind(id).run();

  return c.json({ data: { id, name: user.id, status: 'inactive' } });
});

// PATCH /employees/:id/activate
employees.patch('/:id/activate', async (c) => {
  const { id } = c.req.param();

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE id = ?`,
  ).bind(id).first<{ id: string }>();
  if (!user) throw Errors.NotFound('Employee', id);

  await c.env.DB.prepare(
    `UPDATE users SET status = 'active' WHERE id = ?`,
  ).bind(id).run();

  return c.json({ data: { id, name: user.id, status: 'active' } });
});

// PATCH /employees/:id/reset-password
employees.patch('/:id/reset-password', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as { newPassword: string };

  if (!body.newPassword || body.newPassword.length < 8) {
    throw Errors.ValidationError('Password must be at least 8 characters');
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE id = ?`,
  ).bind(id).first<{ id: string }>();
  if (!user) throw Errors.NotFound('Employee', id);

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
  ).bind(passwordHash, id).run();

  return c.json({ data: { message: 'Password reset successfully' } });
});

// PATCH /employees/:id/delete — Soft delete
employees.patch('/:id/delete', async (c) => {
  const { id } = c.req.param();

  const user = await c.env.DB.prepare(
    `SELECT id, name, status, role FROM users WHERE id = ?`,
  ).bind(id).first<{ id: string; name: string; status: string; role: string }>();
  if (!user) throw Errors.NotFound('Employee', id);
  if (user.status === 'deleted') throw Errors.BadRequest('Employee is already deleted');

  if (user.role === 'manager') {
    const activeManagerCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM users WHERE role = 'manager' AND status != 'deleted'`,
    ).first<{ cnt: number }>();
    if ((activeManagerCount?.cnt ?? 0) <= 1) {
      throw Errors.BusinessRule(
        'LAST_MANAGER',
        'Cannot delete the last active Manager. Promote another employee first.',
      );
    }
  }

  await c.env.DB.prepare(
    `UPDATE users SET status = 'deleted' WHERE id = ?`,
  ).bind(id).run();

  return c.json({ data: { id: user.id, name: user.name, status: 'deleted' } });
});

// ─── Clients ───────────────────────────────────────────────────────────────

const clients = new Hono<AppBindings>();
clients.use('/*', authenticate, authorize(['manager', 'overseer']));

// GET /clients
clients.get('/', async (c) => {
  const query = c.req.query();
  const q = query.q;
  const limit = Math.min(parseInt(query.limit ?? '50'), 100);

  let whereSql = "WHERE role = 'client'";
  const params: string[] = [];
  if (q && q.trim()) {
    whereSql += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.phone, u.email, u.created_at,
            (SELECT COUNT(*) FROM cars WHERE client_id = u.id AND deleted_at IS NULL) as car_count,
            (SELECT COUNT(*) FROM repair_jobs rj JOIN cars c ON c.id = rj.car_id WHERE c.client_id = u.id) as repair_count
     FROM users u ${whereSql}
     ORDER BY u.created_at DESC LIMIT ?`,
  ).bind(...params, limit).all<any>();

  return c.json({
    data: (rows.results ?? []).map((r: any) => ({
      id: r.id, name: r.name, phone: r.phone, email: r.email,
      createdAt: r.created_at, carCount: r.car_count, repairCount: r.repair_count,
    })),
  });
});

// GET /clients/:id
clients.get('/:id', async (c) => {
  const { id } = c.req.param();

  const client = await c.env.DB.prepare(
    `SELECT id, name, phone, email, created_at FROM users WHERE id = ? AND role = 'client'`,
  ).bind(id).first<any>();
  if (!client) throw Errors.NotFound('Client', id);

  const cars = await c.env.DB.prepare(
    `SELECT id, matricule, make, model, year, notes, created_at
     FROM cars WHERE client_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
  ).bind(id).all<any>();

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.car_id, rj.description, rj.status, rj.created_at, rj.final_total,
            c.matricule, c.make, c.model,
            u.name as mechanic_name
     FROM repair_jobs rj
     JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     WHERE c.client_id = ? AND c.deleted_at IS NULL
     ORDER BY rj.created_at DESC`,
  ).bind(id).all<any>();

  return c.json({
    data: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      createdAt: client.created_at,
      cars: (cars.results ?? []).map((c: any) => ({
        id: c.id, matricule: c.matricule, make: c.make, model: c.model,
        year: c.year, notes: c.notes, createdAt: c.created_at,
      })),
      repairs: (repairs.results ?? []).map((r: any) => ({
        id: r.id, carId: r.car_id, description: r.description, status: r.status,
        totalCost: r.final_total, createdAt: r.created_at,
        matricule: r.matricule, make: r.make, model: r.model,
        mechanicName: r.mechanic_name,
      })),
    },
  });
});

export { employees, clients };
