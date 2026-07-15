import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { Errors, AppError } from '../../utils/errors';
import { signToken, verifyToken, authenticate } from '../../middleware/auth';
import { normalizePhone } from '../../utils/phone';

const auth = new Hono<AppBindings>();

const LoginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
}).refine(
  (data) => Boolean(data.identifier || data.email),
  { message: 'Identifier or email required', path: ['identifier'] },
);

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = LoginSchema.parse(body);
  const identifier = parsed.identifier ?? parsed.email!;

  const user = await c.env.DB.prepare(
    `SELECT id, name, email, password_hash, role, phone, status FROM users WHERE phone = ? OR email = ?`,
  )
    .bind(identifier, identifier)
    .first<{ id: string; name: string; email: string; password_hash: string; role: string; phone: string | null; status: string }>();

  if (!user) throw Errors.Unauthorized('Invalid credentials');
  if (user.status !== 'active') throw Errors.Unauthorized('Your account has been deactivated');

  const passwordValid = await bcrypt.compare(parsed.password, user.password_hash);
  if (!passwordValid) throw Errors.Unauthorized('Invalid credentials');

  const accessToken = await signToken(
    { sub: user.id, role: user.role, type: 'access' },
    c.env,
  );
  const refreshToken = await signToken(
    { sub: user.id, role: user.role, type: 'refresh' },
    c.env,
    c.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  );

  return c.json({
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    },
  });
});

// POST /auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const { name, phone, password, role, specialty } = body as {
    name: string; phone: string; password: string; role?: string; specialty?: string;
  };

  const normalizedPhone = normalizePhone(phone);
  if (!name || name.length < 2) throw Errors.ValidationError('Name must be at least 2 characters');
  if (!normalizedPhone || !/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) throw Errors.ValidationError('Invalid phone number format');

  const existingUser = await c.env.DB.prepare(
    `SELECT id FROM users WHERE phone = ?`,
  ).bind(normalizedPhone).first();
  if (existingUser) throw Errors.BadRequest('A user with this phone number already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, specialty, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
  )
    .bind(id, name, normalizedPhone, passwordHash, role ?? 'manager', specialty ?? null)
    .run();

  return c.json({
    data: {
      user: { id, name, phone: normalizedPhone, email: normalizedPhone, role: role ?? 'manager', specialty, status: 'active' },
      message: 'Account created successfully',
    },
  }, 201);
});

// POST /auth/refresh
auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json() as { refreshToken: string };
  if (!refreshToken) throw Errors.BadRequest('Refresh token required');

  try {
    const payload = await verifyToken(refreshToken, c.env);
    if (payload.type !== 'refresh') throw Errors.Unauthorized('Invalid token type');

    const user = await c.env.DB.prepare(
      `SELECT id, role, status FROM users WHERE id = ?`,
    ).bind(payload.sub).first<{ id: string; role: string; status: string }>();

    if (!user || user.status !== 'active') {
      throw Errors.Unauthorized('Account not found or deactivated');
    }

    const accessToken = await signToken(
      { sub: user.id, role: user.role, type: 'access' },
      c.env,
    );

    return c.json({ data: { accessToken } });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw Errors.Unauthorized('Invalid or expired refresh token');
  }
});

// POST /auth/logout
auth.post('/logout', authenticate, async (c) => {
  return c.json({ data: { message: 'Logged out successfully' } });
});

// POST /auth/portal/register
auth.post('/portal/register', async (c) => {
  const body = await c.req.json() as {
    name: string; phone: string; password: string;
  };

  body.phone = normalizePhone(body.phone);
  if (!body.name || body.name.length < 2) throw Errors.ValidationError('Name must be at least 2 characters');
  if (!body.phone || !/^\+?[1-9]\d{7,14}$/.test(body.phone)) throw Errors.ValidationError('Invalid phone number format');
  if (!body.password || body.password.length < 6) throw Errors.ValidationError('Password must be at least 6 characters');

  const existingUser = await c.env.DB.prepare(
    `SELECT id FROM users WHERE phone = ?`,
  ).bind(body.phone).first();
  if (existingUser) throw Errors.BadRequest('A user with this phone number already exists');

  const passwordHash = await bcrypt.hash(body.password, 10);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, 'client', 'active')`,
  )
    .bind(id, body.name, `client_${body.phone}@sagman.local`, passwordHash, body.phone)
    .run();

  const accessToken = await signToken(
    { sub: id, role: 'client', type: 'client' },
    c.env,
  );

  return c.json({
    data: {
      accessToken,
      client: { id, name: body.name, phone: body.phone },
      message: 'Account created successfully',
    },
  }, 201);
});

// POST /auth/portal/login
auth.post('/portal/login', async (c) => {
  const body = await c.req.json() as { phone: string; password: string };

  if (!body.phone) throw Errors.ValidationError('Phone number required');
  if (!body.password) throw Errors.ValidationError('Password required');

  const user = await c.env.DB.prepare(
    `SELECT id, name, password_hash, status FROM users WHERE phone = ? AND role = 'client'`,
  ).bind(body.phone).first<{ id: string; name: string; password_hash: string; status: string }>();

  if (!user) throw Errors.Unauthorized('Invalid credentials');
  if (user.status !== 'active') throw Errors.Unauthorized('Your account has been deactivated');

  const passwordValid = await bcrypt.compare(body.password, user.password_hash);
  if (!passwordValid) throw Errors.Unauthorized('Invalid credentials');

  const accessToken = await signToken(
    { sub: user.id, role: 'client', type: 'client' },
    c.env,
  );

  return c.json({
    data: {
      accessToken,
      client: { id: user.id, name: user.name, phone: body.phone },
    },
  });
});

export { auth };
