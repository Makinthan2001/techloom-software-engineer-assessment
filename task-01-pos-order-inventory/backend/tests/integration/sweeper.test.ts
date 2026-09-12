import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { sweepExpiredReservations } from '../../src/jobs/reservationExpirySweeper.js';
import crypto from 'crypto';

describe('Reservation Expiry & Restart-Safe Sweeper Integration Tests', { timeout: 30000 }, () => {
  let cashierToken: string;
  let cashierId: string;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'sweeper_cashier@example.com' },
      update: {},
      create: {
        name: 'Sweeper Cashier',
        email: 'sweeper_cashier@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashierId = user.id;
    cashierToken = signAccessToken({ userId: user.id, role: 'CASHIER' });
  });

  // Helper to create an order with a reservation that has a specific expiresAt
  async function createOrderWithReservation(expiresAt: Date, buyQty = 2, initialStockRemaining = 8) {
    const product = await prisma.product.create({
      data: {
        name: `Sweeper Test Prod ${crypto.randomUUID()}`,
        price: 35.0,
        stock: initialStockRemaining, // Stock already decremented at checkout
      },
    });

    const order = await prisma.order.create({
      data: {
        userId: cashierId,
        status: 'RESERVED',
        totalAmount: 35.0 * buyQty,
        idempotencyKey: `swp-key-${crypto.randomUUID()}`,
        items: {
          create: [{ productId: product.id, quantity: buyQty, unitPrice: 35.0 }],
        },
        reservations: {
          create: [
            {
              productId: product.id,
              quantity: buyQty,
              status: 'ACTIVE',
              expiresAt,
            },
          ],
        },
      },
      include: { items: true, reservations: true },
    });

    return { product, order };
  }

  it('1. Sweeper job releases expired reservation, transitions Order to EXPIRED, and restores stock', async () => {
    // Reservation expired 10 minutes ago
    const pastExpiresAt = new Date(Date.now() - 10 * 60 * 1000);
    const { product, order } = await createOrderWithReservation(pastExpiresAt, 2, 8); // Initial stock = 8

    // Run sweeper job cycle
    const sweptCount = await sweepExpiredReservations();
    expect(sweptCount).toBeGreaterThanOrEqual(1);

    // Verify reservation status is RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
    expect(resv?.releasedAt).not.toBeNull();

    // Verify Order status is EXPIRED
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('EXPIRED');

    // Verify stock is RESTORED from 8 to 10 (+2)
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(10);
  });

  it('2. Sweeper idempotency / Double-release: Running sweeper twice on an already-released reservation is a no-op (stock NOT double-restored)', async () => {
    const pastExpiresAt = new Date(Date.now() - 5 * 60 * 1000);
    const { product, order } = await createOrderWithReservation(pastExpiresAt, 3, 7); // Initial stock = 7

    // First sweep cycle -> releases reservation and restores stock to 10
    const swept1 = await sweepExpiredReservations();
    expect(swept1).toBeGreaterThanOrEqual(1);

    const prodAfterSweep1 = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodAfterSweep1?.stock).toBe(10);

    // Second sweep cycle -> reservation is now RELEASED, should be skipped
    const swept2 = await sweepExpiredReservations();

    // Confirm stock remains 10 (NOT restored a second time to 13)
    const prodAfterSweep2 = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodAfterSweep2?.stock).toBe(10);
  });

  it('3. Lazy Expiration on Read: GET /api/orders/:id on a stale RESERVED order self-corrects status to EXPIRED and restores stock inline', async () => {
    const pastExpiresAt = new Date(Date.now() - 15 * 60 * 1000);
    const { product, order } = await createOrderWithReservation(pastExpiresAt, 4, 6); // Initial stock = 6

    // Send GET /api/orders/:id
    const res = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('EXPIRED');

    // Verify stock was restored in DB from 6 to 10
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(10);

    // Verify reservation in DB is RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
  });

  it('4. RESTART SIMULATION: Seed past-due ACTIVE reservation in DB, simulate process reboot by calling sweeper as fresh process, confirm correct expiration & stock restoration', async () => {
    // 1. Seed past-due active reservation directly in DB (simulating server crash/reboot while reservation was active)
    const pastExpiresAt = new Date(Date.now() - 20 * 60 * 1000);
    const { product, order } = await createOrderWithReservation(pastExpiresAt, 5, 5); // Initial stock = 5

    console.log('\n🔄 SIMULATING SERVER RESTART...');
    console.log(`Pre-restart state: Order ${order.id} is RESERVED, Stock is ${product.stock}, Reservation expiresAt was 20 mins ago.`);

    // 2. Simulate fresh boot of sweeper job
    const sweptCount = await sweepExpiredReservations();
    console.log(`Post-restart sweep output: Swept ${sweptCount} expired reservation(s).`);

    // 3. Assert reservation status RELEASED, Order status EXPIRED, stock restored
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });

    console.log('--- RESTART SIMULATION TEST OUTPUT ---');
    console.log(`Final Order Status: ${updatedOrder?.status}`);
    console.log(`Final Reservation Status: ${resv?.status}`);
    console.log(`Final Stock Value: ${updatedProd?.stock}`);
    console.log('--------------------------------------\n');

    expect(updatedOrder?.status).toBe('EXPIRED');
    expect(resv?.status).toBe('RELEASED');
    expect(updatedProd?.stock).toBe(10); // 5 + 5 = 10
  });
});
