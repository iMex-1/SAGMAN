import { z } from 'zod';

export const PortalBookAppointmentSchema = z.object({
  carId: z.string().cuid().optional(),
  carMatricule: z.string().max(20).optional(),
  purpose: z.string().min(5).max(500),
  requestedAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type PortalBookAppointmentInput = z.infer<typeof PortalBookAppointmentSchema>;
