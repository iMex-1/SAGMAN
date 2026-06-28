-- CreateEnum
CREATE TYPE "Role" AS ENUM ('overseer', 'manager', 'mechanic');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'confirmed', 'rescheduled', 'cancelled', 'converted');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('received', 'diagnosing', 'awaiting_approval', 'in_progress', 'waiting_for_parts', 'complete', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'emergency');

-- CreateEnum
CREATE TYPE "ClientApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'bypassed');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('received', 'used', 'adjustment');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('before', 'during', 'after');

-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('Engine', 'Brakes', 'Electrical', 'Bodywork', 'Suspension', 'Other');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp_code" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "vin" TEXT,
    "mileage" INTEGER,
    "notes" TEXT,
    "client_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "client_name" TEXT NOT NULL,
    "client_phone" TEXT NOT NULL,
    "car_id" TEXT,
    "car_matricule" TEXT,
    "purpose" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "rescheduled_to" TIMESTAMP(3),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'pending',
    "cancellation_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_jobs" (
    "id" TEXT NOT NULL,
    "car_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "created_by" TEXT NOT NULL,
    "primary_mechanic_id" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'received',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "description" TEXT NOT NULL,
    "internal_notes" TEXT,
    "diagnosis_report" JSONB,
    "diagnosis_shared" BOOLEAN NOT NULL DEFAULT false,
    "client_approval_status" "ClientApprovalStatus" NOT NULL DEFAULT 'pending',
    "client_approval_bypass_reason" TEXT,
    "estimated_duration_hours" DOUBLE PRECISION,
    "estimated_cost" DECIMAL(10,2),
    "parts_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "labor_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "target_completion_date" TIMESTAMP(3),
    "actual_completion_date" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "reopened_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_mechanics" (
    "repair_id" TEXT NOT NULL,
    "mechanic_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_mechanics_pkey" PRIMARY KEY ("repair_id","mechanic_id")
);

-- CreateTable
CREATE TABLE "repair_status_logs" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_work_logs" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "mechanic_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours_spent" DOUBLE PRECISION NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delay_reports" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "reported_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delay_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "category" "PartCategory" NOT NULL DEFAULT 'Other',
    "compatible_models" TEXT,
    "unit_cost" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "min_threshold" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "type" "StockTransactionType" NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "repair_id" TEXT,
    "done_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_parts" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "quantity_used" INTEGER NOT NULL,
    "unit_cost_at_time" DECIMAL(10,2) NOT NULL,
    "stock_override" BOOLEAN NOT NULL DEFAULT false,
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_items" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "amount_billed" DECIMAL(10,2) NOT NULL,
    "parts_total" DECIMAL(10,2) NOT NULL,
    "labor_total" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_total" DECIMAL(10,2) NOT NULL,
    "amount_received" DECIMAL(10,2) NOT NULL,
    "change_due" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "paid_by_name" TEXT,
    "received_by" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_photos" (
    "id" TEXT NOT NULL,
    "repair_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "sent_by" TEXT NOT NULL,
    "message_preview" TEXT NOT NULL,
    "repair_id" TEXT,
    "appointment_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "cars_matricule_key" ON "cars"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "repair_jobs_appointment_id_key" ON "repair_jobs"("appointment_id");

-- CreateIndex
CREATE INDEX "repair_jobs_car_id_status_idx" ON "repair_jobs"("car_id", "status");

-- CreateIndex
CREATE INDEX "repair_jobs_target_completion_date_idx" ON "repair_jobs"("target_completion_date");

-- CreateIndex
CREATE INDEX "repair_jobs_status_idx" ON "repair_jobs"("status");

-- CreateIndex
CREATE INDEX "repair_jobs_priority_idx" ON "repair_jobs"("priority");

-- CreateIndex
CREATE INDEX "repair_status_logs_repair_id_idx" ON "repair_status_logs"("repair_id");

-- CreateIndex
CREATE INDEX "parts_quantity_min_threshold_idx" ON "parts"("quantity", "min_threshold");

-- CreateIndex
CREATE INDEX "stock_transactions_part_id_idx" ON "stock_transactions"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_repair_id_key" ON "payments"("repair_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_number_key" ON "payments"("invoice_number");

-- CreateIndex
CREATE INDEX "notification_logs_sent_at_idx" ON "notification_logs"("sent_at");

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_primary_mechanic_id_fkey" FOREIGN KEY ("primary_mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_mechanics" ADD CONSTRAINT "repair_mechanics_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_mechanics" ADD CONSTRAINT "repair_mechanics_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_logs" ADD CONSTRAINT "repair_status_logs_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_status_logs" ADD CONSTRAINT "repair_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_work_logs" ADD CONSTRAINT "repair_work_logs_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_work_logs" ADD CONSTRAINT "repair_work_logs_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delay_reports" ADD CONSTRAINT "delay_reports_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delay_reports" ADD CONSTRAINT "delay_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_done_by_fkey" FOREIGN KEY ("done_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_parts" ADD CONSTRAINT "repair_parts_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_items" ADD CONSTRAINT "labor_items_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_items" ADD CONSTRAINT "labor_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repair_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
