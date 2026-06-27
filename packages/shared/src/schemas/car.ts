import { z } from 'zod';

export const CreateCarSchema = z.object({
  matricule: z.string().min(1).max(20).toUpperCase(),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  color: z.string().max(30).optional(),
  vin: z.string().max(17).optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
  clientId: z.string().cuid().optional(),
});

export const UpdateCarSchema = CreateCarSchema.partial().omit({ matricule: true });

export type CreateCarInput = z.infer<typeof CreateCarSchema>;
export type UpdateCarInput = z.infer<typeof UpdateCarSchema>;
