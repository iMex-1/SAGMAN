import { z } from 'zod';

export const PresignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  type: z.enum(['before', 'during', 'after']),
});

export const SavePhotoSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['before', 'during', 'after']),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;
export type SavePhotoInput = z.infer<typeof SavePhotoSchema>;
