import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authorize } from '../../middleware/authorize';
import { authenticate } from '../../middleware/auth';

const settings = new Hono<AppBindings>();

const PUBLIC_KEYS = [
  'garage_name',
  'garage_phone',
  'garage_address',
  'garage_hours',
  'garage_email',
];

const PUBLIC_DEFAULTS: Record<string, string> = {
  garage_name: 'Garage Sagman',
  garage_phone: '+212 6 XX XX XX XX',
  garage_address: 'Casablanca, Morocco',
  garage_hours: 'Lun-Sam: 8h-18h',
  garage_email: 'contact@sagman.ma',
};

// GET /settings/public
settings.get('/public', async (c) => {
  const placeholders = PUBLIC_KEYS.map(() => '?').join(',');
  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings WHERE key IN (${placeholders})`,
  ).bind(...PUBLIC_KEYS).all<{ key: string; value: string }>();

  const settingsMap: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    settingsMap[row.key] = row.value;
  }

  return c.json({ data: { ...PUBLIC_DEFAULTS, ...settingsMap } });
});

// GET /settings
settings.get('/', authenticate, authorize(['manager', 'overseer']), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings`,
  ).all<{ key: string; value: string }>();

  const settingsMap: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    settingsMap[row.key] = row.value;
  }

  return c.json({ data: settingsMap });
});

// PATCH /settings
settings.patch('/', authenticate, authorize(['manager']), async (c) => {
  const body = await c.req.json() as Record<string, unknown>;
  const entries = Object.entries(body).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    throw Errors.BadRequest('No settings provided to update');
  }

  const stmts = entries.map(([key, value]) =>
    c.env.DB.prepare(
      `INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(key, String(value)),
  );
  await c.env.DB.batch(stmts);

  const allRows = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings`,
  ).all<{ key: string; value: string }>();

  const settingsMap: Record<string, string> = {};
  for (const row of allRows.results ?? []) {
    settingsMap[row.key] = row.value;
  }

  return c.json({ data: settingsMap });
});

export { settings };
