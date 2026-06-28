import { z } from 'zod';

export const RegisterPaymentSchema = z.object({
  repairId: z.string().cuid(),
  amountBilled: z.number().positive(),
  amountReceived: z.number().positive(),
  discountAmount: z.number().min(0).default(0),
  paidByName: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type RegisterPaymentInput = z.infer<typeof RegisterPaymentSchema>;
