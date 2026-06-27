import { z } from 'zod';
import { PartCategory } from '../types/enums';

export const CreatePartSchema = z.object({
  name: z.string().min(1).max(200),
  reference: z.string().max(50).optional(),
  category: z.nativeEnum(PartCategory).default(PartCategory.Other),
  compatibleModels: z.string().max(500).optional(),
  unitCost: z.number().positive(),
  quantity: z.number().int().min(0).default(0),
  minThreshold: z.number().int().min(0).default(0),
  supplier: z.string().max(200).optional(),
});

export const UpdatePartSchema = CreatePartSchema.partial();

export const AddStockSchema = z.object({
  quantity: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

export const AdjustStockSchema = z.object({
  quantityChange: z.number().int(),
  note: z.string().min(5).max(500),
});

export type CreatePartInput = z.infer<typeof CreatePartSchema>;
export type UpdatePartInput = z.infer<typeof UpdatePartSchema>;
export type AddStockInput = z.infer<typeof AddStockSchema>;
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;
