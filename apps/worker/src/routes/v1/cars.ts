import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';

const cars = new Hono<AppBindings>();
cars.use('/*', authenticate, authorize(['manager', 'overseer']));

// GET /cars
cars.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  let whereSql = 'WHERE deleted_at IS NULL';
  const params: string[] = [];

  if (query.q) {
    whereSql = `WHERE deleted_at IS NULL AND (matricule LIKE ? OR make LIKE ? OR model LIKE ?)`;
    const q = `%${query.q}%`;
    params.push(q, q, q);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM cars ${whereSql}`,
  ).bind(...params).first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = await c.env.DB.prepare(
    `SELECT c.id, c.matricule, c.make, c.model, c.year, c.color, c.vin, c.mileage, c.notes, c.client_id, c.created_at,
            u.id as client_id_val, u.name as client_name
     FROM cars c
     LEFT JOIN users u ON u.id = c.client_id
     ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    matricule: r.matricule,
    make: r.make,
    model: r.model,
    year: r.year,
    color: r.color,
    vin: r.vin,
    mileage: r.mileage,
    notes: r.notes,
    clientId: r.client_id,
    createdAt: r.created_at,
    client: r.client_id_val ? { id: r.client_id_val, name: r.client_name } : null,
  }));

  return c.json(paginate(data, total, page, limit));
});

// POST /cars
cars.post('/', async (c) => {
  const body = await c.req.json() as any;
  const matriculeUpper = (body.matricule ?? '').toUpperCase();

  const existing = await c.env.DB.prepare(
    `SELECT id FROM cars WHERE matricule = ?`,
  ).bind(matriculeUpper).first();
  if (existing) {
    throw Errors.Conflict(`A car with matricule '${matriculeUpper}' already exists`);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO cars (id, matricule, make, model, year, color, vin, mileage, notes, client_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    matriculeUpper,
    body.make,
    body.model,
    body.year ?? null,
    body.color ?? null,
    body.vin ?? null,
    body.mileage ?? null,
    body.notes ?? null,
    body.clientId ?? null,
  ).run();

  return c.json({
    data: { id, ...body, matricule: matriculeUpper },
  }, 201);
});

// GET /cars/:id
cars.get('/:id', async (c) => {
  const { id } = c.req.param();

  const car = await c.env.DB.prepare(
    `SELECT c.*, u.id as client_id_val, u.name as client_name, u.phone as client_phone
     FROM cars c
     LEFT JOIN users u ON u.id = c.client_id
     WHERE c.id = ? AND c.deleted_at IS NULL`,
  ).bind(id).first<any>();

  if (!car) throw Errors.NotFound('Car', id);

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.status, rj.priority, rj.created_at, rj.actual_completion_date,
            u.name as mechanic_name
     FROM repair_jobs rj
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     WHERE rj.car_id = ?
     ORDER BY rj.created_at DESC
     LIMIT 10`,
  ).bind(id).all();

  return c.json({
    data: {
      id: car.id,
      matricule: car.matricule,
      make: car.make,
      model: car.model,
      year: car.year,
      color: car.color,
      vin: car.vin,
      mileage: car.mileage,
      notes: car.notes,
      clientId: car.client_id,
      deletedAt: car.deleted_at,
      createdAt: car.created_at,
      client: car.client_id_val ? { id: car.client_id_val, name: car.client_name, phone: car.client_phone } : null,
      repairs: (repairs.results ?? []).map((r: any) => ({
        id: r.id,
        status: r.status,
        priority: r.priority,
        createdAt: r.created_at,
        actualCompletionDate: r.actual_completion_date,
        primaryMechanic: { name: r.mechanic_name },
      })),
    },
  });
});

// PATCH /cars/:id
cars.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(
    `SELECT id, matricule FROM cars WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string; matricule: string }>();
  if (!existing) throw Errors.NotFound('Car', id);

  if (body.matricule && body.matricule.toUpperCase() !== existing.matricule) {
    throw Errors.BadRequest('Matricule cannot be changed after creation', 'IMMUTABLE_FIELD');
  }

  const { matricule: _m, ...updateData } = body;
  if (Object.keys(updateData).length === 0) {
    throw Errors.BadRequest('No fields to update');
  }

  const setClauses: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(updateData)) {
    const col = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    setClauses.push(`${col} = ?`);
    params.push(value ?? null);
  }
  params.push(id);

  await c.env.DB.prepare(
    `UPDATE cars SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
  ).bind(...params).run();

  return c.json({ data: { id, ...body } });
});

// DELETE /cars/:id (soft delete)
cars.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const car = await c.env.DB.prepare(
    `SELECT id FROM cars WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string }>();
  if (!car) throw Errors.NotFound('Car', id);

  const activeCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM repair_jobs WHERE car_id = ? AND status NOT IN ('delivered', 'cancelled')`,
  ).bind(id).first<{ cnt: number }>();

  if ((activeCount?.cnt ?? 0) > 0) {
    throw Errors.BusinessRule(
      'CAR_HAS_ACTIVE_REPAIRS',
      `Cannot delete car with ${activeCount?.cnt} active repair(s). Close or cancel them first.`,
    );
  }

  await c.env.DB.prepare(
    `UPDATE cars SET deleted_at = ? WHERE id = ?`,
  ).bind(new Date().toISOString(), id).run();

  return c.json({ data: { message: 'Car deleted' } });
});

// GET /cars/:id/repairs
cars.get('/:id/repairs', async (c) => {
  const { id } = c.req.param();
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  const car = await c.env.DB.prepare(
    `SELECT id FROM cars WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string }>();
  if (!car) throw Errors.NotFound('Car', id);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM repair_jobs WHERE car_id = ?`,
  ).bind(id).first<{ total: number }>();

  const repairs = await c.env.DB.prepare(
    `SELECT rj.id, rj.status, rj.priority, rj.created_at, rj.actual_completion_date,
            u.name as mechanic_name
     FROM repair_jobs rj
     LEFT JOIN users u ON u.id = rj.primary_mechanic_id
     WHERE rj.car_id = ?
     ORDER BY rj.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(id, limit, skip).all();

  const data = (repairs.results ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    priority: r.priority,
    createdAt: r.created_at,
    actualCompletionDate: r.actual_completion_date,
    primaryMechanic: { name: r.mechanic_name },
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

export { cars };
