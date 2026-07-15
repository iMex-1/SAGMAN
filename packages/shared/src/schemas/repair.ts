import { z } from 'zod';
import { RepairStatus, Priority, ClientApprovalStatus } from '../types/enums';

const DiagnosisIssueSchema = z.object({
  description: z.string().min(1),
  severity: z.enum(['Minor', 'Moderate', 'Critical']),
});

export const DiagnosisReportSchema = z.object({
  issues: z.array(DiagnosisIssueSchema),
  recommendedRepairs: z.string().optional(),
  estimatedDurationHours: z.number().positive().optional(),
  additionalNotes: z.string().optional(),
});

export const CreateRepairSchema = z.object({
  carId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  primaryMechanicId: z.string().cuid(),
  secondaryMechanicIds: z.array(z.string().cuid()).optional(),
  priority: z.nativeEnum(Priority).default(Priority.normal),
  description: z.string().min(5).max(1000),
  internalNotes: z.string().max(1000).optional(),
  estimatedDurationHours: z.number().positive().optional(),
  targetCompletionDate: z.string().datetime().optional(),
});

export const UpdateRepairStatusSchema = z.object({
  status: z.nativeEnum(RepairStatus),
  note: z.string().max(500).optional(),
  reopenedReason: z.string().max(500).optional(),
  cancellationReason: z.string().max(500).optional(),
  finalTotal: z.number().positive().optional(),
});

export const ClientApprovalSchema = z.object({
  status: z.nativeEnum(ClientApprovalStatus),
  bypassReason: z.string().max(500).optional(),
});

export const AddWorkLogSchema = z.object({
  description: z.string().min(1).max(1000),
  hoursSpent: z.number().positive().max(24),
});

export const DelayReportSchema = z.object({
  reason: z.string().min(5).max(1000),
  evidenceNote: z.string().max(500).optional(),
});

export const AssignPartSchema = z.object({
  partId: z.string().cuid(),
  quantityUsed: z.number().int().positive(),
  stockOverride: z.boolean().optional().default(false),
});

export const AddLaborItemSchema = z.object({
  description: z.string().min(1).max(200),
  cost: z.number().positive(),
});

export type CreateRepairInput = z.infer<typeof CreateRepairSchema>;
export type UpdateRepairStatusInput = z.infer<typeof UpdateRepairStatusSchema>;
export type DiagnosisReportInput = z.infer<typeof DiagnosisReportSchema>;
export type AddWorkLogInput = z.infer<typeof AddWorkLogSchema>;
export type DelayReportInput = z.infer<typeof DelayReportSchema>;
export type AssignPartInput = z.infer<typeof AssignPartSchema>;
export type AddLaborItemInput = z.infer<typeof AddLaborItemSchema>;
