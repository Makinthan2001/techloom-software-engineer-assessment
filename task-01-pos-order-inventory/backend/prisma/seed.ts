import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

async function main() {
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] || 'admin@gmail.com';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] || 'admin123';
  const cashierEmail = process.env['SEED_CASHIER_EMAIL'] || 'user1@gmail.com';
  const cashierPassword = process.env['SEED_CASHIER_PASSWORD'] || 'user123';

  console.log('🌱 Seeding database with initial staff accounts and PC parts...');

  const adminPasswordHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: 'System Admin',
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
      name: 'User 1 (Cashier)',
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
    },
    create: {
      name: 'User 1 (Cashier)',
      email: cashierEmail.toLowerCase(),
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
    },
  });

  const user2PasswordHash = await hashPassword('user2123');
  const user2User = await prisma.user.upsert({
    where: { email: 'user2@gmail.com' },
    update: {
      name: 'User 2 (Cashier)',
      passwordHash: user2PasswordHash,
      role: 'CASHIER',
    },
    create: {
      name: 'User 2 (Cashier)',
      email: 'user2@gmail.com',
      passwordHash: user2PasswordHash,
      role: 'CASHIER',
    },
  });

  console.log(`✅ Seeded ADMIN account: ${adminUser.email}`);
  console.log(`✅ Seeded CASHIER account: ${cashierUser.email}`);
  console.log(`✅ Seeded CASHIER account: ${user2User.email}`);

  // Seed PC Parts Products with prices in LKR (no null values)
  const pcParts = [
    { name: 'NVIDIA GeForce RTX 4070 Super 12GB', price: 245000.00, stock: 15 },
    { name: 'AMD Ryzen 7 7800X3D Processor', price: 155000.00, stock: 20 },
    { name: 'Corsair Vengeance DDR5 32GB (2x16GB) 6000MHz RAM', price: 42500.00, stock: 40 },
    { name: 'Samsung 990 PRO 2TB NVMe M.2 SSD', price: 58000.00, stock: 30 },
    { name: 'ASUS ROG Strix B650-A Gaming WiFi Motherboard', price: 89000.00, stock: 25 },
    { name: 'Corsair RM850x 850W 80+ Gold Power Supply', price: 46500.00, stock: 35 },
    { name: 'NZXT H7 Flow RGB Mid-Tower Case', price: 38500.00, stock: 18 },
    { name: 'ASUS TUF Gaming 27" 180Hz IPS Gaming Monitor', price: 79500.00, stock: 22 },
    { name: 'Logitech G Pro X Superlight 2 Wireless Mouse', price: 48000.00, stock: 50 },
    { name: 'Keychron Q1 Pro Wireless Mechanical Keyboard', price: 62000.00, stock: 30 },
    { name: 'DeepCool AK620 Digital CPU Air Cooler', price: 24500.00, stock: 45 },
  ];

  console.log('🖥️ Seeding PC Parts products (LKR)...');
  for (const item of pcParts) {
    const existing = await prisma.product.findFirst({
      where: { name: item.name },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: item.price,
          stock: item.stock,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          price: item.price,
          stock: item.stock,
        },
      });
    }
  }

  console.log(`✅ Seeded ${pcParts.length} PC parts products successfully.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

