import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';

const reports = new Hono<AppBindings>();
reports.use('/*', authenticate, authorize(['manager', 'overseer']));

// GET /reports/end-of-day
reports.get('/end-of-day', async (c) => {
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const [carsReceived, carsDelivered, activeRepairs, overdueRepairs, lowStockParts, revenueRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT rj.id, c.matricule, c.make, c.model FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id WHERE rj.created_at >= ? AND rj.created_at < ?`,
    ).bind(dayStart, dayEnd).all<any>(),
    c.env.DB.prepare(
      `SELECT rj.id, c.matricule, c.make, c.model, CAST(pm.final_total AS REAL) as revenue FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id LEFT JOIN payments pm ON pm.repair_id = rj.id WHERE rj.status = 'delivered' AND rj.actual_completion_date >= ? AND rj.actual_completion_date < ?`,
    ).bind(dayStart, dayEnd).all<any>(),
    c.env.DB.prepare(
      `SELECT rj.id, rj.status, c.matricule, c.make, c.model, u.name as mechanic_name FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id LEFT JOIN users u ON u.id = rj.primary_mechanic_id WHERE rj.status NOT IN ('delivered', 'cancelled') ORDER BY CASE rj.priority WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END`,
    ).all<any>(),
    c.env.DB.prepare(
      `SELECT rj.id, rj.target_completion_date, c.matricule, c.make, c.model, dr.reason FROM repair_jobs rj LEFT JOIN cars c ON c.id = rj.car_id LEFT JOIN delay_reports dr ON dr.repair_id = rj.id WHERE rj.status NOT IN ('complete', 'delivered', 'cancelled') AND rj.target_completion_date IS NOT NULL AND rj.target_completion_date < ?`,
    ).bind(today.toISOString()).all<any>(),
    c.env.DB.prepare(
      `SELECT name, CAST(quantity AS INTEGER) as quantity, CAST(min_threshold AS INTEGER) as min_threshold FROM parts WHERE CAST(quantity AS INTEGER) <= CAST(min_threshold AS INTEGER) AND deleted_at IS NULL`,
    ).all<any>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(CAST(final_total AS REAL)), 0) as total FROM payments WHERE created_at >= ? AND created_at < ?`).bind(dayStart, dayEnd).first<{ total: number }>(),
  ]);

  const totalRevenue = parseFloat(String(revenueRow?.total ?? '0'));

  return c.json({
    data: {
      date: dayStart,
      carsReceived: (carsReceived.results ?? []).map((r: any) => ({ id: r.id, car: { matricule: r.matricule, make: r.make, model: r.model } })),
      carsDelivered: (carsDelivered.results ?? []).map((r: any) => ({ id: r.id, car: { matricule: r.matricule, make: r.make, model: r.model }, revenue: r.revenue ?? 0 })),
      totalRevenue,
      activeRepairs: (activeRepairs.results ?? []).map((r: any) => ({ id: r.id, car: { matricule: r.matricule, make: r.make, model: r.model }, status: r.status, mechanic: r.mechanic_name })),
      overdueRepairs: (overdueRepairs.results ?? []).map((r: any) => ({
        id: r.id,
        car: { matricule: r.matricule, make: r.make, model: r.model },
        reason: r.reason ?? 'Aucune raison documentée',
        daysSinceTarget: r.target_completion_date ? Math.floor((today.getTime() - new Date(r.target_completion_date).getTime()) / 86400000) : 0,
      })),
      lowStockParts: (lowStockParts.results ?? []).map((p: any) => ({ name: p.name, quantity: p.quantity, minThreshold: p.min_threshold })),
    },
  });
});

// POST /reports/end-of-day/send
reports.post('/end-of-day/send', async (c) => {
  const user = c.get('user');
  const body = await c.req.json() as { notes: string; reportData: any };

  const settings = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings WHERE key IN ('overseer_whatsapp_number', 'garage_name')`,
  ).all<{ key: string; value: string }>();
  const settingsMap: Record<string, string> = {};
  for (const s of settings.results ?? []) settingsMap[s.key] = s.value;

  const overseerPhone = settingsMap['overseer_whatsapp_number'] ?? '';
  const garageName = settingsMap['garage_name'] ?? 'Garage Sagman';

  const managerUser = await c.env.DB.prepare(
    `SELECT name FROM users WHERE id = ?`,
  ).bind(user.sub).first<{ name: string }>();

  const d = body.reportData;
  const date = new Date(d.date).toLocaleDateString('fr-FR');
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const activeList = (d.activeRepairs ?? []).map((r: any) =>
    `• ${r.car?.make ?? ''} ${r.car?.model ?? ''} — ${r.car?.matricule ?? ''} — ${r.status} — ${r.mechanic}`
  ).join('\n') || 'Aucun';

  const overdueList = (d.overdueRepairs ?? []).length > 0
    ? d.overdueRepairs.map((r: any) =>
        `• ${r.car?.make ?? ''} ${r.car?.model ?? ''} — ${r.car?.matricule ?? ''}\n  Retard: ${r.daysSinceTarget}j\n  Raison: ${r.reason}`
      ).join('\n')
    : 'AUCUN RETARD';

  const stockList = (d.lowStockParts ?? []).length > 0
    ? d.lowStockParts.map((p: any) => `• ${p.name} — Qté: ${p.quantity} (min: ${p.minThreshold})`).join('\n')
    : 'AUCUNE ALERTE';

  const separator = '═'.repeat(24);
  const divider = '─'.repeat(16);

  const message = [
    `RAPPORT JOURNALIER`,
    `${garageName.toUpperCase()}`,
    separator,
    `📅 Date : ${date}`,
    `⏰ Heure : ${time}`,
    `👤 Responsable : ${managerUser?.name ?? 'Manager'}`,
    ``,
    `ACTIVITÉ DU JOUR`,
    divider,
    `Véhicules reçus    : ${(d.carsReceived ?? []).length}`,
    `Véhicules livrés   : ${(d.carsDelivered ?? []).length}`,
    `Chiffre d'affaires : ${(d.totalRevenue ?? 0).toFixed(2)} DH`,
    ``,
    `ATELIER EN COURS (${(d.activeRepairs ?? []).length} véhicules)`,
    divider,
    activeList,
    ``,
    `RETARDS`,
    divider,
    overdueList,
    ``,
    `ALERTES STOCK`,
    divider,
    stockList,
    ``,
    `NOTES DU RESPONSABLE`,
    divider,
    body.notes || '(Aucune note)',
    ``,
    separator,
    garageName,
  ].join('\n');

  await c.env.DB.prepare(
    `INSERT INTO notification_logs (id, type, recipient_phone, sent_by, message_preview)
     VALUES (?, 'T-06', ?, ?, ?)`,
  ).bind(crypto.randomUUID(), overseerPhone || 'not_configured', user.sub, message.slice(0, 200)).run();

  const waUrl = overseerPhone
    ? `https://wa.me/${overseerPhone.replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  return c.json({ data: { waUrl, message } });
});

export { reports };
