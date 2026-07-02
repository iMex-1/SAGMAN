import bcrypt from 'bcryptjs';

const DEFAULT_SETTINGS: Record<string, string> = {
  garage_name: 'Garage Sagman',
  garage_address: '',
  garage_phone: '',
  garage_logo_url: '',
  max_concurrent_cars: '5',
  working_hours: 'Mon-Sat 08:00-18:00',
  overseer_whatsapp_number: '',
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

  // Invoice Counter
  console.log('  → Seeding invoice counter...');
  const currentYear = new Date().getFullYear().toString();
  await db.prepare(
    `INSERT OR IGNORE INTO invoice_counters (year, last_seq) VALUES (?, 0)`,
  ).bind(currentYear).run();
  console.log(`  ✓ Invoice counter for ${currentYear}`);

  console.log('Seed completed successfully!');
}
