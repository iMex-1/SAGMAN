import { z } from 'zod';
import { AppointmentStatus } from '../types/enums';

export const CreateAppointmentSchema = z.object({
  clientId: z.string().cuid().optional(),
  clientName: z.string().min(2).max(100),
  clientPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  carId: z.string().cuid().optional(),
  carMatricule: z.string().max(20).optional(),
  purpose: z.string().min(5).max(500),
  requestedAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const ConfirmAppointmentSchema = z.object({
  confirmedAt: z.string().datetime().optional(),
});

export const RescheduleAppointmentSchema = z.object({
  rescheduledTo: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const CancelAppointmentSchema = z.object({
  cancellationReason: z.string().min(5).max(500),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

// Re-export for convenience (used in status transitions)
export { AppointmentStatus };
