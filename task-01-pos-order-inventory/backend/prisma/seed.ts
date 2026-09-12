import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

async function main() {
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] || 'admin@techloom.ai';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] || 'Admin@123456';
  const cashierEmail = process.env['SEED_CASHIER_EMAIL'] || 'cashier@techloom.ai';
  const cashierPassword = process.env['SEED_CASHIER_PASSWORD'] || 'Cashier@123456';

  console.log('🌱 Seeding database with initial staff accounts...');

  const adminPasswordHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
    create: {
      name: 'System Admin',
      email: adminEmail.toLowerCase(),
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const cashierPasswordHash = await hashPassword(cashierPassword);
  const cashierUser = await prisma.user.upsert({
    where: { email: cashierEmail.toLowerCase() },
    update: {
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
    },
    create: {
      name: 'POS Cashier',
      email: cashierEmail.toLowerCase(),
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
    },
  });

  console.log(`✅ Seeded ADMIN account: ${adminUser.email}`);
  console.log(`✅ Seeded CASHIER account: ${cashierUser.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
