import { z } from 'zod';
import { Role, UserStatus } from '../types/enums';

export const CreateEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(Role).refine((r) => r !== Role.overseer, {
    message: 'Cannot create an overseer account',
  }),
  phone: z.string().optional(),
  specialty: z.string().max(200).optional(),
});

export const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  specialty: z.string().max(200).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
