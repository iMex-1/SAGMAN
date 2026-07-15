-- Add CIN and address columns to users
ALTER TABLE users ADD COLUMN cin TEXT;
ALTER TABLE users ADD COLUMN address TEXT;

-- Add receipt image to stock_transactions
ALTER TABLE stock_transactions ADD COLUMN receipt_image_url TEXT;

-- Add payment_type (replaces method) and check_image to payments
ALTER TABLE payments ADD COLUMN payment_type TEXT;
ALTER TABLE payments ADD COLUMN check_image_url TEXT;

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    comment TEXT,
    is_visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
