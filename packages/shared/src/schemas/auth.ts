import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
  password: z.string().min(6),
  role: z.enum(['overseer', 'manager', 'mechanic']).default('manager'),
  specialty: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
