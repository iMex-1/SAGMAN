import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';

const health = new Hono<AppBindings>();

health.get('/', async (c) => {
  let dbStatus = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1').run();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  return c.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: '1.0.0',
    },
    status === 'ok' ? 200 : 503,
  );
});

export { health };
