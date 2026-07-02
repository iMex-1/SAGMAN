import { createMiddleware } from 'hono/factory';
import type { Env } from '../bindings';
import { Errors } from '../utils/errors';
import type { JwtPayload } from './auth';

export function authorize(allowedRoles: string[]) {
  return createMiddleware<{ Bindings: Env; Variables: { user: JwtPayload } }>(async (c, next) => {
    const user = c.get('user');
    if (!allowedRoles.includes(user.role)) {
      throw Errors.Forbidden(
        `This action requires one of these roles: ${allowedRoles.join(', ')}`,
      );
    }
    await next();
  });
}
