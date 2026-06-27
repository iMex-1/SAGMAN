import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

async function main() {
  console.log('🌱 Starting seed...');

  // ─── System Settings ──────────────────────────────────────────────────────
  console.log('  → Seeding system settings...');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSettings.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log(`  ✓ ${Object.keys(DEFAULT_SETTINGS).length} settings upserted`);

  // ─── Default Manager Account ──────────────────────────────────────────────
  console.log('  → Seeding manager account...');
  const managerPasswordHash = await bcrypt.hash('Admin@2024', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'admin@sagman.garage' },
    update: {},
    create: {
      name: 'Admin Manager',
      email: 'admin@sagman.garage',
      passwordHash: managerPasswordHash,
      role: 'manager',
      status: 'active',
    },
  });
  console.log(`  ✓ Manager: ${manager.email} (id: ${manager.id})`);

  // ─── Sample Mechanic Account ──────────────────────────────────────────────
  console.log('  → Seeding mechanic account...');
  const mechanicPasswordHash = await bcrypt.hash('Mechanic@2024', 12);
  const mechanic = await prisma.user.upsert({
    where: { email: 'ahmed@sagman.garage' },
    update: {},
    create: {
      name: 'Ahmed Mechanic',
      email: 'ahmed@sagman.garage',
      passwordHash: mechanicPasswordHash,
      role: 'mechanic',
      specialty: 'Engine, Suspension',
      status: 'active',
    },
  });
  console.log(`  ✓ Mechanic: ${mechanic.email} (id: ${mechanic.id})`);

  // ─── Invoice Counter ──────────────────────────────────────────────────────
  console.log('  → Seeding invoice counter...');
  const currentYear = new Date().getFullYear();
  const counter = await prisma.invoiceCounter.upsert({
    where: { year: currentYear },
    update: {},
    create: { year: currentYear, lastSeq: 0 },
  });
  console.log(`  ✓ Invoice counter for ${counter.year} (lastSeq: ${counter.lastSeq})`);

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
