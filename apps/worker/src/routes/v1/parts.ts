import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';

const parts = new Hono<AppBindings>();
parts.use('/*', authenticate);

// GET /parts
parts.get('/', authorize(['manager', 'mechanic']), async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  let whereSql = 'WHERE deleted_at IS NULL';
  const params: string[] = [];

  if (query.q) {
    whereSql = `WHERE deleted_at IS NULL AND (name LIKE ? OR reference LIKE ?)`;
    const q = `%${query.q}%`;
    params.push(q, q);
  }
  if (query.category) { whereSql += ' AND category = ?'; params.push(query.category); }

  if (query.lowStock === 'true') {
    whereSql += ' AND CAST(quantity AS INTEGER) <= CAST(min_threshold AS INTEGER)';
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM parts ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT * FROM parts ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    ...r,
    unitCost: parseFloat(r.unit_cost ?? '0'),
    quantity: parseInt(r.quantity ?? '0'),
    minThreshold: parseInt(r.min_threshold ?? '0'),
    isLowStock: parseInt(r.quantity ?? '0') <= parseInt(r.min_threshold ?? '0'),
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

// POST /parts
parts.post('/', authorize(['manager', 'overseer']), async (c) => {
  const body = await c.req.json() as any;
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO parts (id, name, reference, category, compatible_models, unit_cost, quantity, min_threshold, supplier)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, body.name, body.reference ?? null,
    body.category ?? 'Other', body.compatibleModels ?? null,
    String(body.unitCost ?? 0), String(body.quantity ?? 0),
    String(body.minThreshold ?? 0), body.supplier ?? null,
  ).run();

  return c.json({ data: { id, ...body, unitCost: body.unitCost ?? 0, isLowStock: (body.quantity ?? 0) <= (body.minThreshold ?? 0) } }, 201);
});

// GET /parts/:id
parts.get('/:id', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();

  const row = await c.env.DB.prepare(
    `SELECT p.*, st.id as st_id, st.type as st_type, st.quantity_change, st.quantity_after, st.created_at as st_created_at, st.note as st_note,
            u.id as u_id, u.name as u_name
     FROM parts p
     LEFT JOIN stock_transactions st ON st.part_id = p.id
     LEFT JOIN users u ON u.id = st.done_by
     WHERE p.id = ? AND p.deleted_at IS NULL
     ORDER BY st.created_at DESC
     LIMIT 20`,
  ).bind(id).all<any>();

  if (!row.results || row.results.length === 0) {
    const part = await c.env.DB.prepare(`SELECT * FROM parts WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
    if (!part) throw Errors.NotFound('Part', id);
    return c.json({ data: { ...part, stockTransactions: [] } });
  }

  const partBase = row.results[0];
  const transactions = row.results.filter((r: any) => r.st_id).map((r: any) => ({
    id: r.st_id,
    type: r.st_type,
    quantityChange: parseInt(r.quantity_change),
    quantityAfter: parseInt(r.quantity_after),
    createdAt: r.st_created_at,
    note: r.st_note,
    doneBy: { id: r.u_id, name: r.u_name },
  }));

  return c.json({
    data: {
      id: partBase.id,
      name: partBase.name,
      reference: partBase.reference,
      category: partBase.category,
      compatibleModels: partBase.compatible_models,
      unitCost: parseFloat(partBase.unit_cost ?? '0'),
      quantity: parseInt(partBase.quantity ?? '0'),
      minThreshold: parseInt(partBase.min_threshold ?? '0'),
      supplier: partBase.supplier,
      deletedAt: partBase.deleted_at,
      createdAt: partBase.created_at,
      updatedAt: partBase.updated_at,
      isLowStock: parseInt(partBase.quantity ?? '0') <= parseInt(partBase.min_threshold ?? '0'),
      stockTransactions: transactions,
    },
  });
});

// PATCH /parts/:id
parts.patch('/:id', authorize(['manager', 'overseer']), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json() as any;

  const existing = await c.env.DB.prepare(
    `SELECT id FROM parts WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string }>();
  if (!existing) throw Errors.NotFound('Part', id);

  const { quantity: _q, ...updates } = body;
  const setClauses: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name', reference: 'reference', category: 'category',
    compatibleModels: 'compatible_models', unitCost: 'unit_cost',
    minThreshold: 'min_threshold', supplier: 'supplier',
  };

  for (const [key, value] of Object.entries(updates)) {
    const col = fieldMap[key];
    if (col && value !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(String(value));
    }
  }

  if (setClauses.length > 0) {
    params.push(id);
    await c.env.DB.prepare(`UPDATE parts SET ${setClauses.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  return c.json({ data: { id, ...body } });
});

// DELETE /parts/:id
parts.delete('/:id', authorize(['manager', 'overseer']), async (c) => {
  const { id } = c.req.param();

  const part = await c.env.DB.prepare(
    `SELECT id FROM parts WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<{ id: string }>();
  if (!part) throw Errors.NotFound('Part', id);

  const usageCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM repair_parts WHERE part_id = ?`,
  ).bind(id).first<{ cnt: number }>();
  if ((usageCount?.cnt ?? 0) > 0) {
    throw Errors.BusinessRule('PART_IN_USE', 'Cannot delete a part that has been used in repairs');
  }

  await c.env.DB.prepare(
    `UPDATE parts SET deleted_at = ? WHERE id = ?`,
  ).bind(new Date().toISOString(), id).run();

  return c.json({ data: { message: 'Part deleted successfully' } });
});

// POST /parts/:id/stock
parts.post('/:id/stock', authorize(['manager', 'overseer']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { quantity: number; note?: string };

  const part = await c.env.DB.prepare(
    `SELECT * FROM parts WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<any>();
  if (!part) throw Errors.NotFound('Part', id);

  const currentQty = parseInt(part.quantity ?? '0');
  const newQuantity = currentQty + body.quantity;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE parts SET quantity = ?, updated_at = ? WHERE id = ?`,
    ).bind(String(newQuantity), new Date().toISOString(), id),
    c.env.DB.prepare(
      `INSERT INTO stock_transactions (id, part_id, type, quantity_change, quantity_after, done_by, note)
       VALUES (?, ?, 'received', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), id, String(body.quantity), String(newQuantity), user.sub, body.note ?? null),
  ]);

  return c.json({ data: { id, ...part, quantity: newQuantity, isLowStock: newQuantity <= parseInt(part.min_threshold ?? '0') } });
});

// POST /parts/:id/adjust
parts.post('/:id/adjust', authorize(['manager', 'overseer']), async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const body = await c.req.json() as { quantityChange: number; note: string };

  const part = await c.env.DB.prepare(
    `SELECT * FROM parts WHERE id = ? AND deleted_at IS NULL`,
  ).bind(id).first<any>();
  if (!part) throw Errors.NotFound('Part', id);

  const currentQty = parseInt(part.quantity ?? '0');
  const newQuantity = currentQty + body.quantityChange;

  if (newQuantity < 0) {
    throw Errors.BusinessRule('INSUFFICIENT_STOCK', `Adjustment would result in negative stock (current: ${currentQty}, change: ${body.quantityChange})`);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE parts SET quantity = ?, updated_at = ? WHERE id = ?`,
    ).bind(String(newQuantity), new Date().toISOString(), id),
    c.env.DB.prepare(
      `INSERT INTO stock_transactions (id, part_id, type, quantity_change, quantity_after, done_by, note)
       VALUES (?, ?, 'adjustment', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), id, String(body.quantityChange), String(newQuantity), user.sub, body.note),
  ]);

  return c.json({ data: { id, ...part, quantity: newQuantity, isLowStock: newQuantity <= parseInt(part.min_threshold ?? '0') } });
});

// GET /parts/:id/transactions
parts.get('/:id/transactions', authorize(['manager', 'mechanic']), async (c) => {
  const { id } = c.req.param();
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  const part = await c.env.DB.prepare(`SELECT id FROM parts WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
  if (!part) throw Errors.NotFound('Part', id);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM stock_transactions WHERE part_id = ?`,
  ).bind(id).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT st.*, u.name as u_name
     FROM stock_transactions st
     LEFT JOIN users u ON u.id = st.done_by
     WHERE st.part_id = ?
     ORDER BY st.created_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(id, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    partId: r.part_id,
    type: r.type,
    quantityChange: parseInt(r.quantity_change),
    quantityAfter: parseInt(r.quantity_after),
    repairId: r.repair_id,
    note: r.note,
    createdAt: r.created_at,
    doneBy: { id: r.done_by, name: r.u_name },
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

export { parts };
