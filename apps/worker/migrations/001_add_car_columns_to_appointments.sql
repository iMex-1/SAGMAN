-- Add car detail columns to appointments table
ALTER TABLE appointments ADD COLUMN car_make TEXT;
ALTER TABLE appointments ADD COLUMN car_model TEXT;
ALTER TABLE appointments ADD COLUMN car_year TEXT;
ALTER TABLE appointments ADD COLUMN car_color TEXT;
