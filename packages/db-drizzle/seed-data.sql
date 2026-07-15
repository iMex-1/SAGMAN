-- =============================================================
-- SAGMAN Sample Data Seed
-- Run with: wrangler d1 execute sagman --file=seed-data.sql --remote
-- =============================================================

-- 1. Overseer Account (password: Overseer@2024)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, specialty, status)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Overseer Manager',
  'overseer@sagman.garage',
  '$2a$12$RN11.sqrKFOEy.L8mvSjO.rCAT/1D5nypY9bpJIhBYHbkxLrhMMt.',
  'overseer',
  'Supervision',
  'active'
);

-- 2. Second Client (password: Client@2024)
INSERT OR IGNORE INTO users (id, name, email, password_hash, phone, role, status)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Fatima Benali',
  'client_+212600000001@sagman.local',
  '$2a$12$6L5DlIQQwo8d5fLTi6fRpO1Ly2leUSRpWagVplDsdmwKo0Ijy3m02',
  '+212600000001',
  'client',
  'active'
);

-- 3. Second Client's Car
INSERT OR IGNORE INTO cars (id, matricule, make, model, year, color, client_id, notes)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '54321-B-7',
  'Renault',
  'Clio 4',
  2020,
  'Blanc',
  '00000000-0000-0000-0000-000000000010',
  'Climatisation faible'
);

-- 4. Another Car for existing Client Mohamed (d3d2eade-9a4f-4aea-b2b8-7bb1cc76c5f3)
INSERT OR IGNORE INTO cars (id, matricule, make, model, year, color, client_id, notes)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '98765-G-3',
  'Dacia',
  'Sandero',
  2022,
  'Gris',
  'd3d2eade-9a4f-4aea-b2b8-7bb1cc76c5f3',
  'Vidange recommandée tous les 10 000 km'
);

-- 5. In-Progress Repair for Renault Clio (Fatima's car)
-- Primary mechanic: Ahmed Mechanic (00000000-0000-0000-0000-000000000002)
INSERT OR IGNORE INTO repair_jobs (id, car_id, created_by, primary_mechanic_id, status, priority, description, internal_notes, estimated_cost, target_completion_date, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'in_progress',
  'high',
  'Révision complète + climatisation',
  'Client signale que la climatisation ne refroidit plus. Vérifier le compresseur et le niveau de gaz.',
  2500,
  '2026-07-10',
  '2026-07-05 09:00:00'
);

-- 6. Diagnosing Repair for Dacia Sandero (Mohamed's car)
-- Primary mechanic: Imade mechanic
INSERT OR IGNORE INTO repair_jobs (id, car_id, created_by, primary_mechanic_id, status, priority, description, target_completion_date, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'bde40090-0da2-4f68-87e5-5a1f5e2e3e3b',
  'diagnosing',
  'normal',
  'Voyant moteur allumé',
  '2026-07-12',
  '2026-07-06 08:30:00'
);

-- 7. Sample Parts
INSERT OR IGNORE INTO parts (id, name, reference, category, compatible_models, unit_cost, quantity, min_threshold, supplier)
VALUES
  ('00000000-0000-0000-0000-000000000040', 'Plaquettes de frein avant', 'BRK-TOY-001', 'brakes', 'Toyota Yaris 2018-2024', 350, 10, 3, 'AutoPièces Maroc'),
  ('00000000-0000-0000-0000-000000000041', 'Filtre à huile', 'FIL-OIL-001', 'filters', 'Universel', 80, 25, 5, 'MecaDistrib'),
  ('00000000-0000-0000-0000-000000000042', 'Filtre à air moteur', 'FIL-AIR-001', 'filters', 'Renault Clio 4, Dacia Sandero', 120, 15, 5, 'MecaDistrib'),
  ('00000000-0000-0000-0000-000000000043', 'Huile moteur 5W30 (1L)', 'OIL-5W30-001', 'fluids', 'Universel', 65, 40, 10, 'Total Maroc'),
  ('00000000-0000-0000-0000-000000000044', 'Bougies d''allumage (x4)', 'SPK-TOY-001', 'engine', 'Toyota Yaris 1.5L', 280, 8, 4, 'NGK Distribution'),
  ('00000000-0000-0000-0000-000000000045', 'Courroie de distribution', 'TIM-002', 'engine', 'Renault Clio 4 1.2L', 450, 3, 2, 'Gates France'),
  ('00000000-0000-0000-0000-000000000046', 'Batterie 12V 60Ah', 'BAT-60-001', 'electrical', 'Universel', 650, 5, 2, 'BatteriePro'),
  ('00000000-0000-0000-0000-000000000047', 'Pneu été 195/65R15', 'TRE-SUM-001', 'tires', 'Universel 15 pouces', 550, 8, 2, 'PneuStop'),
  ('00000000-0000-0000-0000-000000000048', 'Disques de frein avant', 'BRK-DSK-001', 'brakes', 'Toyota Yaris, Dacia Sandero', 420, 6, 2, 'AutoPièces Maroc'),
  ('00000000-0000-0000-0000-000000000049', 'Liquide de refroidissement (5L)', 'COL-5L-001', 'fluids', 'Universel', 150, 10, 3, 'Total Maroc');

-- 8. Appointment for tomorrow
INSERT OR IGNORE INTO appointments (id, client_id, client_name, client_phone, car_id, car_matricule, car_make, car_model, car_year, car_color, purpose, requested_at, status, created_by, notes, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  'd3d2eade-9a4f-4aea-b2b8-7bb1cc76c5f3',
  'Mohamed',
  '+212694722954',
  '82d55e0b-fbb0-4437-baa7-243ddb1a74dd',
  '12345-E-6',
  'Toyota',
  'Yaris',
  2018,
  'Bleu',
  'Révision périodique',
  '2026-07-07 10:00:00',
  'confirmed',
  '00000000-0000-0000-0000-000000000001',
  'Vidange + plaquettes de frein',
  '2026-07-06 12:00:00'
);

-- 9. Appointment for Fatima
INSERT OR IGNORE INTO appointments (id, client_id, client_name, client_phone, car_id, car_matricule, car_make, car_model, car_year, car_color, purpose, requested_at, status, created_by, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000010',
  'Fatima Benali',
  '+212600000001',
  '00000000-0000-0000-0000-000000000020',
  '54321-B-7',
  'Renault',
  'Clio 4',
  2020,
  'Blanc',
  'Vérification climatisation',
  '2026-07-08 14:00:00',
  'pending',
  '00000000-0000-0000-0000-000000000001',
  '2026-07-06 12:30:00'
);
