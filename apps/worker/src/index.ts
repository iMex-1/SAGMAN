import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { Env } from './bindings';
import { v1 } from './routes/v1';
import { AppError } from './utils/errors';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/v1/*', cors({
  origin: (origin) => {
    if (!origin) return null;
    try {
      const u = new URL(origin);
      if (u.hostname === 'localhost' && u.port === '3000') return origin;
      if (u.hostname.endsWith('.pages.dev')) return origin;
      if (u.hostname.endsWith('.workers.dev')) return origin;
      if (u.hostname.endsWith('.imexlab.uk')) return origin;
    } catch {}
    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.route('/api/v1', v1);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          statusCode: 422,
          details: err.errors,
        },
      },
      422,
    );
  }

  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.statusCode as any);
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: 'HTTP_ERROR',
          message: err.message,
          statusCode: err.status,
        },
      },
      err.status,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        statusCode: 500,
      },
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.url} not found`,
        statusCode: 404,
      },
    },
    404,
  );
});

export default app;
