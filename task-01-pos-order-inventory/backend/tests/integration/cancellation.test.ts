import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import crypto from 'crypto';

describe('Order Cancellation Integration Tests (POST /api/orders/:orderId/cancel)', { timeout: 30000 }, () => {
  let cashier1Token: string;
  let cashier1Id: string;
  let cashier2Token: string;
  let cashier2Id: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Seed test users
    const cashier1 = await prisma.user.upsert({
      where: { email: 'cancel_cashier1@example.com' },
      update: {},
      create: {
        name: 'Cancel Cashier 1',
        email: 'cancel_cashier1@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier1Id = cashier1.id;
    cashier1Token = signAccessToken({ userId: cashier1.id, role: 'CASHIER' });

    const cashier2 = await prisma.user.upsert({
      where: { email: 'cancel_cashier2@example.com' },
      update: {},
      create: {
        name: 'Cancel Cashier 2',
        email: 'cancel_cashier2@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier2Id = cashier2.id;
    cashier2Token = signAccessToken({ userId: cashier2.id, role: 'CASHIER' });

    const admin = await prisma.user.upsert({
      where: { email: 'cancel_admin@example.com' },
      update: {},
      create: {
        name: 'Cancel Admin',
        email: 'cancel_admin@example.com',
        passwordHash: 'dummy_hash',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;
    adminToken = signAccessToken({ userId: admin.id, role: 'ADMIN' });
  });

  // Helper to setup order in RESERVED or PAID state
  async function setupOrder(status: 'RESERVED' | 'PAID' | 'FAILED' | 'EXPIRED', initialStockRemaining = 7, buyQty = 3) {
    const product = await prisma.product.create({
      data: {
        name: `Cancel Test Prod ${crypto.randomUUID()}`,
        price: 50.0,
        stock: initialStockRemaining, // Stock remaining after purchase
      },
    });

    const resvStatus = status === 'PAID' ? 'FINALIZED' : status === 'RESERVED' ? 'ACTIVE' : 'RELEASED';

    const order = await prisma.order.create({
      data: {
        userId: cashier1Id,
        status,
        totalAmount: 50.0 * buyQty,
        idempotencyKey: `cnl-key-${crypto.randomUUID()}`,
        items: {
          create: [{ productId: product.id, quantity: buyQty, unitPrice: 50.0 }],
        },
        reservations: {
          create: [
            {
              productId: product.id,
              quantity: buyQty,
              status: resvStatus,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          ],
        },
      },
      include: { items: true, reservations: true },
    });

    return { product, order };
  }

  it('1. Cancel a RESERVED order -> stock restored (+qty) exactly once, order becomes CANCELLED', async () => {
    const { product, order } = await setupOrder('RESERVED', 7, 3); // Buy 3, stock remaining = 7

    const res = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    // Verify stock restored from 7 to 10
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(10);

    // Verify reservation status RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
  });

  it('2. Cancel a PAID order -> stock restored (+qty) exactly once, order becomes CANCELLED', async () => {
    const { product, order } = await setupOrder('PAID', 6, 4); // Buy 4, stock remaining = 6

    const res = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    // Verify stock restored from 6 to 10
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(10);

    // Verify reservation status RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
  });

  it('3. Sequential duplicate cancellation on already-CANCELLED order -> stock NOT restored second time, returns clean 200', async () => {
    const { product, order } = await setupOrder('RESERVED', 8, 2);

    // First cancel
    const res1 = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('CANCELLED');

    const prodAfterCancel1 = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodAfterCancel1?.stock).toBe(10); // 8 + 2 = 10

    // Second cancel attempt on already-CANCELLED order
    const res2 = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('CANCELLED');

    // Stock NEVER restored a second time (must remain 10, NOT 12)
    const prodAfterCancel2 = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodAfterCancel2?.stock).toBe(10);
  });

  it('4. CONCURRENCY PROOF: 2 concurrent cancellation calls via Promise.all on same order -> both get clean 200, stock restored ONCE', async () => {
    const { product, order } = await setupOrder('RESERVED', 5, 5); // Stock = 5, Buy = 5

    console.log('\n🚀 Firing 2 concurrent cancellation requests for the same order...');

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${cashier1Token}`),
      request(app)
        .post(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${cashier1Token}`),
    ]);

    console.log('--- CONCURRENT CANCELLATION TEST OUTPUT ---');
    console.log(`Response Status 1: ${res1.status}, Response Status 2: ${res2.status}`);

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const finalProd = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Final Order Status: ${finalOrder?.status}`);
    console.log(`Final Stock Value: ${finalProd?.stock}`);
    console.log('-------------------------------------------\n');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(finalOrder?.status).toBe('CANCELLED');
    expect(finalProd?.stock).toBe(10); // 5 + 5 = 10 (restored exactly once)
  }, 30000);

  it('5. Attempt to cancel FAILED or EXPIRED order -> 409 Conflict (InvalidStateTransitionError)', async () => {
    const { order: failedOrder } = await setupOrder('FAILED', 10, 1);
    const { order: expiredOrder } = await setupOrder('EXPIRED', 10, 1);

    const resFailed = await request(app)
      .post(`/api/orders/${failedOrder.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(resFailed.status).toBe(409);

    const resExpired = await request(app)
      .post(`/api/orders/${expiredOrder.id}/cancel`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(resExpired.status).toBe(409);
  });

  it('6. Authorization: Cashier 2 CANNOT cancel Cashier 1 order (403), but ADMIN CAN (200)', async () => {
    const { order } = await setupOrder('RESERVED', 8, 2);

    // Cashier 2 tries to cancel -> 403 Forbidden
    const resForbidden = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${cashier2Token}`);

    expect(resForbidden.status).toBe(403);

    // Admin tries to cancel -> 200 OK
    const resAdmin = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.data.status).toBe('CANCELLED');
  });
});
