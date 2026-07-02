import { sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['overseer', 'manager', 'mechanic', 'client'] }).notNull(),
  phone: text('phone').unique(),
  specialty: text('specialty'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const cars = sqliteTable('cars', {
  id: text('id').primaryKey(),
  matricule: text('matricule').notNull().unique(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: text('year'),
  color: text('color'),
  vin: text('vin'),
  mileage: text('mileage'),
  notes: text('notes'),
  clientId: text('client_id'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(),
  clientId: text('client_id'),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  carId: text('car_id'),
  carMatricule: text('car_matricule'),
  purpose: text('purpose').notNull(),
  requestedAt: text('requested_at').notNull(),
  confirmedAt: text('confirmed_at'),
  rescheduledTo: text('rescheduled_to'),
  status: text('status', {
    enum: ['pending', 'confirmed', 'rescheduled', 'cancelled', 'converted'],
  }).notNull().default('pending'),
  cancellationReason: text('cancellation_reason'),
  createdById: text('created_by').notNull(),
  notes: text('notes'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const repairJobs = sqliteTable('repair_jobs', {
  id: text('id').primaryKey(),
  carId: text('car_id').notNull(),
  appointmentId: text('appointment_id').unique(),
  createdById: text('created_by').notNull(),
  primaryMechanicId: text('primary_mechanic_id').notNull(),
  status: text('status', {
    enum: ['received', 'diagnosing', 'awaiting_approval', 'in_progress', 'waiting_for_parts', 'complete', 'delivered', 'cancelled'],
  }).notNull().default('received'),
  priority: text('priority', { enum: ['low', 'normal', 'high', 'emergency'] }).notNull().default('normal'),
  description: text('description').notNull(),
  internalNotes: text('internal_notes'),
  diagnosisReport: text('diagnosis_report'),
  diagnosisShared: text('diagnosis_shared').notNull().default('0'),
  clientApprovalStatus: text('client_approval_status', {
    enum: ['pending', 'approved', 'rejected', 'bypassed'],
  }).notNull().default('pending'),
  clientApprovalBypassReason: text('client_approval_bypass_reason'),
  estimatedDurationHours: text('estimated_duration_hours'),
  estimatedCost: text('estimated_cost'),
  partsTotal: text('parts_total').notNull().default('0'),
  laborTotal: text('labor_total').notNull().default('0'),
  discountAmount: text('discount_amount').notNull().default('0'),
  finalTotal: text('final_total').notNull().default('0'),
  targetCompletionDate: text('target_completion_date'),
  actualCompletionDate: text('actual_completion_date'),
  cancellationReason: text('cancellation_reason'),
  reopenedReason: text('reopened_reason'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  carStatusIdx: index('idx_repair_jobs_car_status').on(table.carId, table.status),
  targetDateIdx: index('idx_repair_jobs_target_date').on(table.targetCompletionDate),
  statusIdx: index('idx_repair_jobs_status').on(table.status),
  priorityIdx: index('idx_repair_jobs_priority').on(table.priority),
}));

export const repairMechanics = sqliteTable('repair_mechanics', {
  repairId: text('repair_id').notNull(),
  mechanicId: text('mechanic_id').notNull(),
  isPrimary: text('is_primary').notNull().default('0'),
  assignedAt: text('assigned_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  pk: primaryKey({ columns: [table.repairId, table.mechanicId] }),
}));

export const repairStatusLogs = sqliteTable('repair_status_logs', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedById: text('changed_by').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  repairIdx: index('idx_status_logs_repair').on(table.repairId),
}));

export const repairWorkLogs = sqliteTable('repair_work_logs', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  mechanicId: text('mechanic_id').notNull(),
  description: text('description').notNull(),
  hoursSpent: text('hours_spent').notNull(),
  loggedAt: text('logged_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const delayReports = sqliteTable('delay_reports', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  reportedById: text('reported_by').notNull(),
  reason: text('reason').notNull(),
  evidenceNote: text('evidence_note'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const parts = sqliteTable('parts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  reference: text('reference'),
  category: text('category', {
    enum: ['Engine', 'Brakes', 'Electrical', 'Bodywork', 'Suspension', 'Other'],
  }).notNull().default('Other'),
  compatibleModels: text('compatible_models'),
  unitCost: text('unit_cost').notNull(),
  quantity: text('quantity').notNull().default('0'),
  minThreshold: text('min_threshold').notNull().default('0'),
  supplier: text('supplier'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  stockIdx: index('idx_parts_stock').on(table.quantity, table.minThreshold),
}));

export const stockTransactions = sqliteTable('stock_transactions', {
  id: text('id').primaryKey(),
  partId: text('part_id').notNull(),
  type: text('type', { enum: ['received', 'used', 'adjustment'] }).notNull(),
  quantityChange: text('quantity_change').notNull(),
  quantityAfter: text('quantity_after').notNull(),
  repairId: text('repair_id'),
  doneById: text('done_by').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  partIdx: index('idx_stock_transactions_part').on(table.partId),
}));

export const repairParts = sqliteTable('repair_parts', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  partId: text('part_id').notNull(),
  quantityUsed: text('quantity_used').notNull(),
  unitCostAtTime: text('unit_cost_at_time').notNull(),
  stockOverride: text('stock_override').notNull().default('0'),
  addedById: text('added_by').notNull(),
  addedAt: text('added_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const laborItems = sqliteTable('labor_items', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  description: text('description').notNull(),
  cost: text('cost').notNull(),
  addedById: text('added_by').notNull(),
  addedAt: text('added_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull().unique(),
  amountBilled: text('amount_billed').notNull(),
  partsTotal: text('parts_total').notNull(),
  laborTotal: text('labor_total').notNull(),
  discountAmount: text('discount_amount').notNull().default('0'),
  finalTotal: text('final_total').notNull(),
  amountReceived: text('amount_received').notNull(),
  changeDue: text('change_due').notNull(),
  method: text('method').notNull().default('cash'),
  paidByName: text('paid_by_name'),
  receivedById: text('received_by').notNull(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const repairPhotos = sqliteTable('repair_photos', {
  id: text('id').primaryKey(),
  repairId: text('repair_id').notNull(),
  uploadedById: text('uploaded_by').notNull(),
  type: text('type', { enum: ['before', 'during', 'after'] }).notNull(),
  filePath: text('file_path').notNull(),
  r2Key: text('r2_key'),
  mimeType: text('mime_type'),
  sizeBytes: text('size_bytes'),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const notificationLogs = sqliteTable('notification_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  recipientPhone: text('recipient_phone').notNull(),
  sentById: text('sent_by').notNull(),
  messagePreview: text('message_preview').notNull(),
  repairId: text('repair_id'),
  appointmentId: text('appointment_id'),
  sentAt: text('sent_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => ({
  sentAtIdx: index('idx_notification_logs_sent_at').on(table.sentAt),
}));

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const invoiceCounters = sqliteTable('invoice_counters', {
  year: text('year').primaryKey(),
  lastSeq: text('last_seq').notNull().default('0'),
});
