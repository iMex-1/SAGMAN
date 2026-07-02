import { createMiddleware } from 'hono/factory';
import { jwtVerify, SignJWT } from 'jose';
import type { Env } from '../bindings';
import { Errors, AppError } from '../utils/errors';

export interface JwtPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh' | 'client';
  iat?: number;
  exp?: number;
}

function getSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  env: Env,
  expiresIn?: string,
): Promise<string> {
  const exp = expiresIn ?? env.JWT_ACCESS_EXPIRES_IN ?? '8h';
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret(env));
}

export async function verifyToken(token: string, env: Env): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(env));
  return payload as unknown as JwtPayload;
}

export const authenticate = createMiddleware<{ Bindings: Env; Variables: { user: JwtPayload } }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.Unauthorized('Authentication required');
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, c.env);
    if (payload.type !== 'access') {
      throw Errors.Unauthorized('Access token required');
    }
    c.set('user', payload);
    await next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw Errors.Unauthorized('Invalid or expired token');
  }
});

export const authenticateClient = createMiddleware<{ Bindings: Env; Variables: { user: JwtPayload } }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.Unauthorized('Client authentication required');
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, c.env);
    if (payload.type !== 'client') {
      throw Errors.Unauthorized('Client token required');
    }
    c.set('user', payload);
    await next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw Errors.Unauthorized('Invalid or expired client token');
  }
});
