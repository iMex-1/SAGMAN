import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';
import { getPaginationParams, paginate } from '../../utils/pagination';

const notifications = new Hono<AppBindings>();
notifications.use('/*', authenticate, authorize(['manager', 'overseer']));

// GET /notifications
notifications.get('/', async (c) => {
  const query = c.req.query();
  const { page, limit, skip } = getPaginationParams({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });

  let whereSql = 'WHERE 1=1';
  const params: string[] = [];
  if (query.type) { whereSql += ' AND type = ?'; params.push(query.type); }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM notification_logs ${whereSql}`,
  ).bind(...params).first<{ total: number }>();

  const rows = await c.env.DB.prepare(
    `SELECT nl.*, u.id as u_id, u.name as u_name
     FROM notification_logs nl
     LEFT JOIN users u ON u.id = nl.sent_by
     ${whereSql}
     ORDER BY nl.sent_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, skip).all();

  const data = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    recipientPhone: r.recipient_phone,
    messagePreview: r.message_preview,
    repairId: r.repair_id,
    appointmentId: r.appointment_id,
    sentAt: r.sent_at,
    sentBy: { id: r.u_id, name: r.u_name },
  }));

  return c.json(paginate(data, countRow?.total ?? 0, page, limit));
});

export { notifications };
