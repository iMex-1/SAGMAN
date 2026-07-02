import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';

const employees = new Hono<AppBindings>();
employees.use('/*', authenticate, authorize(['manager']));

// GET /employees
employees.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 50,
  });

  let whereSql = 'WHERE 1=1';
  const params: string[] = [];
  if (query.status) { whereSql += ' AND status = ?'; params.push(query.status); }
  if (query.role) { whereSql += ' AND role = ?'; params.push(query.role); }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM users ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, role, phone, specialty, status, created_at
     FROM users ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  return c.json(paginate(rows.results ?? [], countRow?.total ?? 0, page, limit));
});

// POST /employees
employees.post('/', async (c) => {
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ?`,
  ).bind(body.email).first();
  if (existing) throw Errors.Conflict(`An employee with email '${body.email}' already exists`);

  const passwordHash = await bcrypt.hash(body.password, 12);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, phone, specialty, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
  ).bind(id, body.name, body.email, passwordHash, body.role, body.phone ?? null, body.specialty ?? null).run();

  return c.json({
    data: {
      id, name: body.name, email: body.email,
      role: body.role, phone: body.phone,
      specialty: body.specialty, status: 'active',
    },
  }, 201);
});

// GET /employees/:id
employees.get('/:id', async (c) => {
  const { id } = c.req.param();

  const user = await c.env.DB.prepare(
    `SELECT id, name, email, role, phone, specialty, status, created_at
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

  const setClauses: string[] = [];
  const params: any[] = [];
  for (const key of ['name', 'email', 'phone', 'specialty', 'role']) {
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
      specialty: body.specialty, status: body.status,
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

export { employees };
