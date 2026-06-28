export enum Role {
  overseer = 'overseer',
  manager = 'manager',
  mechanic = 'mechanic',
}

export enum UserStatus {
  active = 'active',
  inactive = 'inactive',
}

export enum AppointmentStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  rescheduled = 'rescheduled',
  cancelled = 'cancelled',
  converted = 'converted',
}

export enum RepairStatus {
  received = 'received',
  diagnosing = 'diagnosing',
  awaiting_approval = 'awaiting_approval',
  in_progress = 'in_progress',
  waiting_for_parts = 'waiting_for_parts',
  complete = 'complete',
  delivered = 'delivered',
  cancelled = 'cancelled',
}

export enum Priority {
  low = 'low',
  normal = 'normal',
  high = 'high',
  emergency = 'emergency',
}

export enum ClientApprovalStatus {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
  bypassed = 'bypassed',
}

export enum StockTransactionType {
  received = 'received',
  used = 'used',
  adjustment = 'adjustment',
}

export enum PhotoType {
  before = 'before',
  during = 'during',
  after = 'after',
}

export enum PartCategory {
  Engine = 'Engine',
  Brakes = 'Brakes',
  Electrical = 'Electrical',
  Bodywork = 'Bodywork',
  Suspension = 'Suspension',
  Other = 'Other',
}

// State machine: maps each status to its allowed next statuses
export const REPAIR_STATUS_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  [RepairStatus.received]: [RepairStatus.diagnosing, RepairStatus.cancelled],
  [RepairStatus.diagnosing]: [RepairStatus.awaiting_approval, RepairStatus.in_progress, RepairStatus.cancelled],
  [RepairStatus.awaiting_approval]: [RepairStatus.in_progress, RepairStatus.cancelled],
  [RepairStatus.in_progress]: [RepairStatus.waiting_for_parts, RepairStatus.complete, RepairStatus.cancelled],
  [RepairStatus.waiting_for_parts]: [RepairStatus.in_progress, RepairStatus.cancelled],
  [RepairStatus.complete]: [RepairStatus.delivered, RepairStatus.in_progress],
  [RepairStatus.delivered]: [],
  [RepairStatus.cancelled]: [],
};

export const TERMINAL_STATUSES = [RepairStatus.delivered, RepairStatus.cancelled];

export const ACTIVE_REPAIR_STATUSES = [
  RepairStatus.received,
  RepairStatus.diagnosing,
  RepairStatus.awaiting_approval,
  RepairStatus.in_progress,
  RepairStatus.waiting_for_parts,
  RepairStatus.complete,
];
