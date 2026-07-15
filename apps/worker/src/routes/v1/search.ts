import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';

const search = new Hono<AppBindings>();
search.use('/*', authenticate, authorize(['manager', 'mechanic', 'overseer']));

// GET /search
search.get('/', async (c) => {
  const q = c.req.query('q');
  const limitParam = c.req.query('limit');

  if (!q || q.trim().length < 2) {
    return c.json({ data: { cars: [], clients: [], repairs: [], invoices: [] } });
  }

  const searchTerm = q.trim();
  const lim = Math.min(parseInt(limitParam ?? '5'), 10);

  const [cars, clients, repairs, invoices] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, matricule, make, model, year FROM cars WHERE deleted_at IS NULL AND matricule LIKE ? LIMIT ?`,
    ).bind(`%${searchTerm}%`, lim).all(),
    c.env.DB.prepare(
      `SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND (name LIKE ? OR phone LIKE ?) LIMIT ?`,
    ).bind(`%${searchTerm}%`, `%${searchTerm}%`, lim).all(),
    c.env.DB.prepare(
      `SELECT rj.id, rj.status, rj.priority, rj.description, c.matricule, c.make, c.model FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id WHERE rj.id LIKE ? LIMIT ?`,
    ).bind(`${searchTerm}%`, lim).all(),
    c.env.DB.prepare(
      `SELECT pm.id, pm.invoice_number, CAST(pm.final_total AS REAL) as final_total, pm.created_at, rj.id as repair_id, c.matricule FROM payments pm LEFT JOIN repair_jobs rj ON rj.id = pm.repair_id LEFT JOIN cars c ON c.id = rj.car_id WHERE pm.invoice_number LIKE ? LIMIT ?`,
    ).bind(`%${searchTerm}%`, lim).all(),
  ]);

  return c.json({
    data: {
      cars: cars.results ?? [],
      clients: clients.results ?? [],
      repairs: (repairs.results ?? []).map((r: any) => ({
        id: r.id, status: r.status, priority: r.priority, description: r.description,
        car: { matricule: r.matricule, make: r.make, model: r.model },
      })),
      invoices: (invoices.results ?? []).map((r: any) => ({
        id: r.id, invoiceNumber: r.invoice_number, finalTotal: r.final_total,
        createdAt: r.created_at,
        repair: { id: r.repair_id, car: { matricule: r.matricule } },
      })),
    },
  });
});

export { search };
