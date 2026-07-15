import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
async function generateInvoiceNumber(db: D1Database): Promise<string> {
  const year = new Date().getFullYear().toString();
  await db.batch([
    db.prepare(`INSERT INTO invoice_counters (year, last_seq) VALUES (?, 0) ON CONFLICT(year) DO NOTHING`).bind(year),
    db.prepare(`UPDATE invoice_counters SET last_seq = last_seq + 1 WHERE year = ?`).bind(year),
  ]);
  const result = await db.prepare(`SELECT last_seq FROM invoice_counters WHERE year = ?`).bind(year).first<{ last_seq: number }>();
  const seq = result?.last_seq ?? 1;
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
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

const VALID_PAYMENT_TYPES = ['cash', 'check', 'card', 'transfer'] as const;
type PaymentType = typeof VALID_PAYMENT_TYPES[number];

const payments = new Hono<AppBindings>();
payments.use('/*', authenticate);

// POST /payments/check-upload — Upload check image (base64 → R2)
payments.post('/check-upload', authorize(['manager', 'overseer']), async (c) => {
  const body = await c.req.json() as { image: string; mimeType?: string };

  if (!body.image) throw Errors.BadRequest('image is required');

  const base64 = body.image.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const key = `payment-checks/${crypto.randomUUID()}`;
  const mimeType = body.mimeType ?? 'image/png';

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${key}`;

  return c.json({ data: { url, key } }, 201);
});

// POST /payments
payments.post('/', authorize(['manager', 'overseer']), async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as any;

  const repair = await c.env.DB.prepare(
    `SELECT rj.*, p.id as existing_payment_id
     FROM repair_jobs rj
     LEFT JOIN payments p ON p.repair_id = rj.id
     WHERE rj.id = ?`,
  ).bind(body.repairId).first<any>();

  if (!repair) throw Errors.NotFound('Repair', body.repairId);
  if (repair.status !== 'complete') {
    throw Errors.BusinessRule('STATUS_NOT_COMPLETE', 'Payment can only be registered when repair is complete');
  }
  if (repair.existing_payment_id) {
    throw Errors.Conflict('Payment already registered for this repair');
  }

  const paymentType: string = body.paymentType || 'cash';
  if (!VALID_PAYMENT_TYPES.includes(paymentType as PaymentType)) {
    throw Errors.ValidationError(`Invalid paymentType. Must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`);
  }
  if (paymentType === 'check' && !body.checkImageUrl) {
    throw Errors.ValidationError('checkImageUrl is required when paymentType is check');
  }

  const invoiceNumber = await generateInvoiceNumber(c.env.DB as any);
  const amountBilled = parseFloat(body.amountBilled) || 0;
  const amountReceived = parseFloat(body.amountReceived) || 0;
  const changeDue = Math.max(0, amountReceived - amountBilled);
  const paymentId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO payments (id, repair_id, amount_billed, parts_total, labor_total, discount_amount, final_total, amount_received, change_due, method, payment_type, check_image_url, paid_by_name, received_by, invoice_number, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    paymentId, body.repairId, String(amountBilled),
    String(repair.parts_total ?? '0'), String(repair.labor_total ?? '0'),
    String(body.discountAmount ?? 0), String(amountBilled),
    String(amountReceived), String(changeDue),
    paymentType,
    paymentType,
    body.checkImageUrl ?? null,
    body.paidByName ?? null, user.sub, invoiceNumber, body.notes ?? null,
  ).run();

  return c.json({
    data: {
      id: paymentId, repairId: body.repairId, invoiceNumber,
      amountBilled, amountReceived, changeDue,
      paymentType, checkImageUrl: body.checkImageUrl ?? null,
      receivedBy: { id: user.sub },
    },
  }, 201);
});

// GET /payments/invoice/:repairId
payments.get('/invoice/:repairId', authorize(['manager', 'overseer']), async (c) => {
  const { repairId } = c.req.param();

  const repair = await c.env.DB.prepare(
    `SELECT rj.*, c.id as c_id, c.matricule, c.make, c.model, c.year, c.color,
            u.id as cl_id, u.name as cl_name, u.phone as cl_phone,
             pm.id as pm_id, pm.invoice_number, pm.final_total, pm.amount_received,
             pm.created_at as pm_created_at, pm.amount_billed, pm.parts_total as pm_parts_total,
             pm.labor_total as pm_labor_total, pm.discount_amount as pm_discount_amount,
             pm.change_due, pm.method, pm.payment_type, pm.check_image_url,
             pm.paid_by_name, pm.notes as pm_notes,
            mech.id as mech_id, mech.name as mech_name,
            creator.id as creator_id, creator.name as creator_name
     FROM repair_jobs rj
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users u ON u.id = c.client_id
     LEFT JOIN payments pm ON pm.repair_id = rj.id
     LEFT JOIN users mech ON mech.id = rj.primary_mechanic_id
     LEFT JOIN users creator ON creator.id = rj.created_by
     WHERE rj.id = ?`,
  ).bind(repairId).first<any>();

  if (!repair) throw Errors.NotFound('Repair', repairId);
  if (!repair.pm_id) throw Errors.BadRequest('No payment registered for this repair');

  const mechanics = await c.env.DB.prepare(
    `SELECT u.id, u.name FROM repair_mechanics rm LEFT JOIN users u ON u.id = rm.mechanic_id WHERE rm.repair_id = ?`,
  ).bind(repairId).all();

  const parts = await c.env.DB.prepare(
    `SELECT rp.*, p.name as part_name, p.reference as part_reference
     FROM repair_parts rp LEFT JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = ?`,
  ).bind(repairId).all();

  const laborItems = await c.env.DB.prepare(
    `SELECT * FROM labor_items WHERE repair_id = ?`,
  ).bind(repairId).all();

  const settings = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings`,
  ).all<{ key: string; value: string }>();
  const settingsMap: Record<string, string> = {};
  for (const s of settings.results ?? []) settingsMap[s.key] = s.value;

  return c.json({
    data: {
      invoice: {
        id: repair.pm_id, invoiceNumber: repair.invoice_number,
        amountBilled: parseFloat(repair.amount_billed),
        partsTotal: parseFloat(repair.pm_parts_total),
        laborTotal: parseFloat(repair.pm_labor_total),
        discountAmount: parseFloat(repair.pm_discount_amount ?? '0'),
        finalTotal: parseFloat(repair.final_total),
        amountReceived: parseFloat(repair.amount_received),
        changeDue: parseFloat(repair.change_due),
        method: repair.method, paymentType: repair.payment_type ?? repair.method,
        checkImageUrl: repair.check_image_url ?? null,
        paidByName: repair.paid_by_name, notes: repair.pm_notes, createdAt: repair.pm_created_at,
      },
      repair: { id: repair.id, description: repair.description, status: repair.status },
      car: { id: repair.c_id, matricule: repair.matricule, make: repair.make, model: repair.model, year: repair.year, color: repair.color },
      client: repair.cl_id ? { id: repair.cl_id, name: repair.cl_name, phone: repair.cl_phone } : null,
      laborItems: (laborItems.results ?? []).map((l: any) => ({ id: l.id, description: l.description, cost: parseFloat(l.cost) })),
      parts: (parts.results ?? []).map((p: any) => ({
        id: p.id, quantityUsed: parseInt(p.quantity_used),
        unitCostAtTime: parseFloat(p.unit_cost_at_time),
        part: { name: p.part_name, reference: p.part_reference },
      })),
      mechanics: (mechanics.results ?? []).map((m: any) => ({ id: m.id, name: m.name })),
      createdBy: { id: repair.creator_id, name: repair.creator_name },
      settings: {
        garageName: settingsMap['garage_name'] ?? 'Garage Sagman',
        garageAddress: settingsMap['garage_address'] ?? '',
        garagePhone: settingsMap['garage_phone'] ?? '',
        currencyLabel: settingsMap['currency_label'] ?? 'DH',
      },
    },
  });
});

// GET /payments/repair/:repairId
payments.get('/repair/:repairId', authorize(['manager', 'mechanic']), async (c) => {
  const { repairId } = c.req.param();

  const payment = await c.env.DB.prepare(
    `SELECT pm.*, u.id as rec_id, u.name as rec_name,
            rj.status, rj.description,
            c.id as c_id, c.matricule, c.make, c.model,
            cl.id as cl_id, cl.name as cl_name, cl.phone as cl_phone,
            mech.id as mech_id, mech.name as mech_name
     FROM payments pm
     LEFT JOIN users u ON u.id = pm.received_by
     LEFT JOIN repair_jobs rj ON rj.id = pm.repair_id
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users cl ON cl.id = c.client_id
     LEFT JOIN users mech ON mech.id = rj.primary_mechanic_id
     WHERE pm.repair_id = ?`,
  ).bind(repairId).first<any>();

  if (!payment) throw Errors.NotFound('Payment for repair', repairId);

  const laborItems = await c.env.DB.prepare(
    `SELECT * FROM labor_items WHERE repair_id = ?`,
  ).bind(repairId).all();

  const parts = await c.env.DB.prepare(
    `SELECT rp.*, p.name as pname, p.reference as pref FROM repair_parts rp LEFT JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = ?`,
  ).bind(repairId).all();

  return c.json({
    data: {
      id: payment.id, repairId: payment.repair_id,
      invoiceNumber: payment.invoice_number,
      amountBilled: parseFloat(payment.amount_billed),
      partsTotal: parseFloat(payment.parts_total),
      laborTotal: parseFloat(payment.labor_total),
      discountAmount: parseFloat(payment.discount_amount ?? '0'),
      finalTotal: parseFloat(payment.final_total),
      amountReceived: parseFloat(payment.amount_received),
      changeDue: parseFloat(payment.change_due),
      method: payment.method, paymentType: payment.payment_type ?? payment.method,
      checkImageUrl: payment.check_image_url ?? null,
      paidByName: payment.paid_by_name, notes: payment.notes, createdAt: payment.created_at,
      receivedBy: { id: payment.rec_id, name: payment.rec_name },
      repair: {
        id: payment.repair_id, status: payment.status, description: payment.description,
        car: payment.c_id ? { id: payment.c_id, matricule: payment.matricule, make: payment.make, model: payment.model } : null,
        client: payment.cl_id ? { id: payment.cl_id, name: payment.cl_name, phone: payment.cl_phone } : null,
        primaryMechanic: { id: payment.mech_id, name: payment.mech_name },
        laborItems: (laborItems.results ?? []).map((l: any) => ({ id: l.id, description: l.description, cost: parseFloat(l.cost) })),
        parts: (parts.results ?? []).map((p: any) => ({
          id: p.id, quantityUsed: parseInt(p.quantity_used),
          unitCostAtTime: parseFloat(p.unit_cost_at_time),
          part: { name: p.pname, reference: p.pref },
        })),
      },
    },
  });
});

// GET /payments/:id
payments.get('/:id', authorize(['manager', 'overseer']), async (c) => {
  const { id } = c.req.param();

  const payment = await c.env.DB.prepare(
    `SELECT pm.*, u.name as rec_name,
            rj.status, rj.description,
            c.id as c_id, c.matricule, c.make, c.model,
            cl.id as cl_id, cl.name as cl_name, cl.phone as cl_phone,
            mech.id as mech_id, mech.name as mech_name
     FROM payments pm
     LEFT JOIN users u ON u.id = pm.received_by
     LEFT JOIN repair_jobs rj ON rj.id = pm.repair_id
     LEFT JOIN cars c ON c.id = rj.car_id
     LEFT JOIN users cl ON cl.id = c.client_id
     LEFT JOIN users mech ON mech.id = rj.primary_mechanic_id
     WHERE pm.id = ?`,
  ).bind(id).first<any>();

  if (!payment) throw Errors.NotFound('Payment', id);

  const laborItems = await c.env.DB.prepare(
    `SELECT * FROM labor_items WHERE repair_id = ?`,
  ).bind(payment.repair_id).all();

  const parts = await c.env.DB.prepare(
    `SELECT rp.*, p.name as pname, p.reference as pref FROM repair_parts rp LEFT JOIN parts p ON p.id = rp.part_id WHERE rp.repair_id = ?`,
  ).bind(payment.repair_id).all();

  return c.json({
    data: {
      id: payment.id, repairId: payment.repair_id,
      invoiceNumber: payment.invoice_number,
      amountBilled: parseFloat(payment.amount_billed),
      partsTotal: parseFloat(payment.parts_total),
      laborTotal: parseFloat(payment.labor_total),
      discountAmount: parseFloat(payment.discount_amount ?? '0'),
      finalTotal: parseFloat(payment.final_total),
      amountReceived: parseFloat(payment.amount_received),
      changeDue: parseFloat(payment.change_due),
      method: payment.method, paymentType: payment.payment_type ?? payment.method,
      checkImageUrl: payment.check_image_url ?? null,
      paidByName: payment.paid_by_name, notes: payment.notes, createdAt: payment.created_at,
      receivedBy: { id: payment.received_by, name: payment.rec_name },
      repair: {
        id: payment.repair_id, status: payment.status, description: payment.description,
        car: payment.c_id ? { id: payment.c_id, matricule: payment.matricule, make: payment.make, model: payment.model } : null,
        client: payment.cl_id ? { id: payment.cl_id, name: payment.cl_name, phone: payment.cl_phone } : null,
        primaryMechanic: { id: payment.mech_id, name: payment.mech_name },
        laborItems: (laborItems.results ?? []).map((l: any) => ({ id: l.id, description: l.description, cost: parseFloat(l.cost) })),
        parts: (parts.results ?? []).map((p: any) => ({
          id: p.id, quantityUsed: parseInt(p.quantity_used),
          unitCostAtTime: parseFloat(p.unit_cost_at_time),
          part: { name: p.pname, reference: p.pref },
        })),
      },
    },
  });
});

export { payments };
