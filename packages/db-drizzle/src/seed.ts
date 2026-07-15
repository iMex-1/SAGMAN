import bcrypt from 'bcryptjs';

const DEFAULT_SETTINGS: Record<string, string> = {
  garage_name: 'Garage Sagman',
  garage_address: '',
  garage_phone: '',
  garage_logo_url: '',
  max_concurrent_cars: '5',
  working_hours: 'Mon-Sat 08:00-18:00',
  overseer_whatsapp_number: '',
  whatsapp_number: '',
  depannage_number: '',
  require_diagnosis_approval: 'true',
  require_client_approval: 'true',
  currency_label: 'DH',
  session_timeout_hours: '8',
};

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface D1PreparedStatement {
  bind(...args: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T>(): Promise<T | null>;
}

interface D1Result {
  success: boolean;
  meta?: any;
}

export async function seed(db: D1Database): Promise<void> {
  console.log('Starting seed...');

  // System Settings
  console.log('  → Seeding system settings...');
  const settingStmts = Object.entries(DEFAULT_SETTINGS).map(([key, value]) =>
    db.prepare(
      `INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)`,
    ).bind(key, value),
  );
  await db.batch(settingStmts);
  console.log(`  ✓ ${Object.keys(DEFAULT_SETTINGS).length} settings inserted`);

  // Default Manager Account
  console.log('  → Seeding manager account...');
  const managerPasswordHash = await bcrypt.hash('Admin@2024', 12);
  const existingManager = await db.prepare(
    `SELECT id FROM users WHERE email = ?`,
  ).bind('admin@sagman.garage').first<{ id: string }>();

  if (!existingManager) {
    const managerId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'manager', 'active')`,
    ).bind(managerId, 'Admin Manager', 'admin@sagman.garage', managerPasswordHash).run();
    console.log(`  ✓ Manager created (id: ${managerId})`);
  } else {
    console.log(`  ✓ Manager already exists (id: ${existingManager.id})`);
  }

  // Sample Mechanic Account
  console.log('  → Seeding mechanic account...');
  const mechanicPasswordHash = await bcrypt.hash('Mechanic@2024', 12);
  const existingMechanic = await db.prepare(
    `SELECT id FROM users WHERE email = ?`,
  ).bind('ahmed@sagman.garage').first<{ id: string }>();

  if (!existingMechanic) {
    const mechanicId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, specialty, status)
       VALUES (?, ?, ?, ?, 'mechanic', ?, 'active')`,
    ).bind(mechanicId, 'Ahmed Mechanic', 'ahmed@sagman.garage', mechanicPasswordHash, 'Engine, Suspension').run();
    console.log(`  ✓ Mechanic created (id: ${mechanicId})`);
  } else {
    console.log(`  ✓ Mechanic already exists (id: ${existingMechanic.id})`);
  }

  // Overseer Account
  console.log('  → Seeding overseer account...');
  const overseerPasswordHash = await bcrypt.hash('Overseer@2024', 12);
  const existingOverseer = await db.prepare(
    `SELECT id FROM users WHERE email = ?`,
  ).bind('overseer@sagman.garage').first<{ id: string }>();
  if (!existingOverseer) {
    await db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, specialty, status)
       VALUES (?, ?, ?, ?, 'overseer', ?, 'active')`,
    ).bind(crypto.randomUUID(), 'Overseer Manager', 'overseer@sagman.garage', overseerPasswordHash, 'Supervision').run();
    console.log('  ✓ Overseer created');
  } else {
    console.log('  ✓ Overseer already exists');
  }

  // Sample Parts
  console.log('  → Seeding sample parts...');
  const parts = [
    { name: 'Plaquettes de frein avant', ref: 'BRK-TOY-001', cat: 'brakes', cost: 350, qty: 10, min: 3, sup: 'AutoPièces Maroc' },
    { name: 'Filtre à huile', ref: 'FIL-OIL-001', cat: 'filters', cost: 80, qty: 25, min: 5, sup: 'MecaDistrib' },
    { name: 'Filtre à air moteur', ref: 'FIL-AIR-001', cat: 'filters', cost: 120, qty: 15, min: 5, sup: 'MecaDistrib' },
    { name: 'Huile moteur 5W30 (1L)', ref: 'OIL-5W30-001', cat: 'fluids', cost: 65, qty: 40, min: 10, sup: 'Total Maroc' },
    { name: 'Bougies d\'allumage (x4)', ref: 'SPK-TOY-001', cat: 'engine', cost: 280, qty: 8, min: 4, sup: 'NGK Distribution' },
    { name: 'Courroie de distribution', ref: 'TIM-002', cat: 'engine', cost: 450, qty: 3, min: 2, sup: 'Gates France' },
    { name: 'Batterie 12V 60Ah', ref: 'BAT-60-001', cat: 'electrical', cost: 650, qty: 5, min: 2, sup: 'BatteriePro' },
    { name: 'Pneu été 195/65R15', ref: 'TRE-SUM-001', cat: 'tires', cost: 550, qty: 8, min: 2, sup: 'PneuStop' },
    { name: 'Disques de frein avant', ref: 'BRK-DSK-001', cat: 'brakes', cost: 420, qty: 6, min: 2, sup: 'AutoPièces Maroc' },
    { name: 'Liquide de refroidissement (5L)', ref: 'COL-5L-001', cat: 'fluids', cost: 150, qty: 10, min: 3, sup: 'Total Maroc' },
  ];
  const partStmts = parts.map((p) =>
    db.prepare(
      `INSERT OR IGNORE INTO parts (id, name, reference, category, compatible_models, unit_cost, quantity, min_threshold, supplier)
       VALUES (?, ?, ?, ?, 'Universel', ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), p.name, p.ref, p.cat, p.cost, p.qty, p.min, p.sup),
  );
  await db.batch(partStmts);
  console.log(`  ✓ ${parts.length} parts seeded`);

  // Invoice Counter
  console.log('  → Seeding invoice counter...');
  const currentYear = new Date().getFullYear().toString();
  await db.prepare(
    `INSERT OR IGNORE INTO invoice_counters (year, last_seq) VALUES (?, 0)`,
  ).bind(currentYear).run();
  console.log(`  ✓ Invoice counter for ${currentYear}`);

  console.log('Seed completed successfully!');
}
