CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`client_name` text NOT NULL,
	`client_phone` text NOT NULL,
	`car_id` text,
	`car_matricule` text,
	`purpose` text NOT NULL,
	`requested_at` text NOT NULL,
	`confirmed_at` text,
	`rescheduled_to` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`cancellation_reason` text,
	`created_by` text NOT NULL,
	`notes` text,
	`deleted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cars` (
	`id` text PRIMARY KEY NOT NULL,
	`matricule` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` text,
	`color` text,
	`vin` text,
	`mileage` text,
	`notes` text,
	`client_id` text,
	`deleted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delay_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`reported_by` text NOT NULL,
	`reason` text NOT NULL,
	`evidence_note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_counters` (
	`year` text PRIMARY KEY NOT NULL,
	`last_seq` text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labor_items` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`description` text NOT NULL,
	`cost` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`sent_by` text NOT NULL,
	`message_preview` text NOT NULL,
	`repair_id` text,
	`appointment_id` text,
	`sent_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`reference` text,
	`category` text DEFAULT 'Other' NOT NULL,
	`compatible_models` text,
	`unit_cost` text NOT NULL,
	`quantity` text DEFAULT '0' NOT NULL,
	`min_threshold` text DEFAULT '0' NOT NULL,
	`supplier` text,
	`deleted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`amount_billed` text NOT NULL,
	`parts_total` text NOT NULL,
	`labor_total` text NOT NULL,
	`discount_amount` text DEFAULT '0' NOT NULL,
	`final_total` text NOT NULL,
	`amount_received` text NOT NULL,
	`change_due` text NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`paid_by_name` text,
	`received_by` text NOT NULL,
	`invoice_number` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`car_id` text NOT NULL,
	`appointment_id` text,
	`created_by` text NOT NULL,
	`primary_mechanic_id` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`description` text NOT NULL,
	`internal_notes` text,
	`diagnosis_report` text,
	`diagnosis_shared` text DEFAULT '0' NOT NULL,
	`client_approval_status` text DEFAULT 'pending' NOT NULL,
	`client_approval_bypass_reason` text,
	`estimated_duration_hours` text,
	`estimated_cost` text,
	`parts_total` text DEFAULT '0' NOT NULL,
	`labor_total` text DEFAULT '0' NOT NULL,
	`discount_amount` text DEFAULT '0' NOT NULL,
	`final_total` text DEFAULT '0' NOT NULL,
	`target_completion_date` text,
	`actual_completion_date` text,
	`cancellation_reason` text,
	`reopened_reason` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_mechanics` (
	`repair_id` text NOT NULL,
	`mechanic_id` text NOT NULL,
	`is_primary` text DEFAULT '0' NOT NULL,
	`assigned_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`repair_id`, `mechanic_id`)
);
--> statement-breakpoint
CREATE TABLE `repair_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`part_id` text NOT NULL,
	`quantity_used` text NOT NULL,
	`unit_cost_at_time` text NOT NULL,
	`stock_override` text DEFAULT '0' NOT NULL,
	`added_by` text NOT NULL,
	`added_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`type` text NOT NULL,
	`file_path` text NOT NULL,
	`r2_key` text,
	`mime_type` text,
	`size_bytes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_status_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_by` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_work_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`repair_id` text NOT NULL,
	`mechanic_id` text NOT NULL,
	`description` text NOT NULL,
	`hours_spent` text NOT NULL,
	`logged_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`part_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity_change` text NOT NULL,
	`quantity_after` text NOT NULL,
	`repair_id` text,
	`done_by` text NOT NULL,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`specialty` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cars_matricule_unique` ON `cars` (`matricule`);--> statement-breakpoint
CREATE INDEX `idx_notification_logs_sent_at` ON `notification_logs` (`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_parts_stock` ON `parts` (`quantity`,`min_threshold`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_repair_id_unique` ON `payments` (`repair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_invoice_number_unique` ON `payments` (`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `repair_jobs_appointment_id_unique` ON `repair_jobs` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `idx_repair_jobs_car_status` ON `repair_jobs` (`car_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_repair_jobs_target_date` ON `repair_jobs` (`target_completion_date`);--> statement-breakpoint
CREATE INDEX `idx_repair_jobs_status` ON `repair_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_repair_jobs_priority` ON `repair_jobs` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_status_logs_repair` ON `repair_status_logs` (`repair_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_transactions_part` ON `stock_transactions` (`part_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);