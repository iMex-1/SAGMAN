import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const RequestOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number'),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
