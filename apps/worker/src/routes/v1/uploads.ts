import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors } from '../../utils/errors';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';

const uploads = new Hono<AppBindings>();

function parseBase64(data: string, fallbackMimeType = 'image/jpeg'): { buffer: Uint8Array; mimeType: string } {
  const base64 = data.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  try {
    return {
      mimeType: fallbackMimeType,
      buffer: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    };
  } catch {
    throw Errors.BadRequest('Invalid image data');
  }
}

// GET /uploads/serve/* — Serve files from R2 (no auth — key is a random UUID)
uploads.get('/serve/*', async (c) => {
  const path = c.req.path;
  const prefix = '/api/v1/uploads/serve/';
  const key = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const object = await c.env.UPLOADS.get(key);
  if (!object) throw Errors.NotFound('File', key);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return c.newResponse(object.body, 200, Object.fromEntries(headers));
});

// POST /uploads/stock-receipt
uploads.post('/stock-receipt', authenticate, authorize(['manager', 'overseer']), async (c) => {
  const body = await c.req.json() as { image: string; mimeType?: string };
  if (!body.image) throw Errors.BadRequest('Image data is required');

  const { buffer, mimeType } = parseBase64(body.image, body.mimeType);
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `stock-receipts/${crypto.randomUUID()}.${ext}`;

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${key}`;
  return c.json({ url, key });
});

// POST /uploads/payment-check
uploads.post('/payment-check', authenticate, authorize(['manager', 'overseer']), async (c) => {
  const body = await c.req.json() as { image: string; mimeType?: string };
  if (!body.image) throw Errors.BadRequest('Image data is required');

  const { buffer, mimeType } = parseBase64(body.image, body.mimeType);
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `payment-checks/${crypto.randomUUID()}.${ext}`;

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${key}`;
  return c.json({ url, key });
});

// POST /uploads/employee-image
uploads.post('/employee-image', authenticate, authorize(['manager', 'overseer']), async (c) => {
  const body = await c.req.json() as { image: string; mimeType?: string };
  if (!body.image) throw Errors.BadRequest('Image data is required');

  const { buffer, mimeType } = parseBase64(body.image, body.mimeType);
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `employee-images/${crypto.randomUUID()}.${ext}`;

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
  });

  const url = `${new URL(c.req.url).origin}/api/v1/uploads/serve/${key}`;
  return c.json({ url, key });
});

export { uploads };
