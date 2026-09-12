import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import crypto from 'crypto';

describe('Mock Payment Integration Tests (POST /api/orders/:orderId/payment)', { timeout: 30000 }, () => {
  let cashier1Token: string;
  let cashier1Id: string;
  let cashier2Token: string;
  let cashier2Id: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Seed test users
    const cashier1 = await prisma.user.upsert({
      where: { email: 'pay_cashier1@example.com' },
      update: {},
      create: {
        name: 'Payment Cashier 1',
        email: 'pay_cashier1@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier1Id = cashier1.id;
    cashier1Token = signAccessToken({ userId: cashier1.id, role: 'CASHIER' });

    const cashier2 = await prisma.user.upsert({
      where: { email: 'pay_cashier2@example.com' },
      update: {},
      create: {
        name: 'Payment Cashier 2',
        email: 'pay_cashier2@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier2Id = cashier2.id;
    cashier2Token = signAccessToken({ userId: cashier2.id, role: 'CASHIER' });

    const admin = await prisma.user.upsert({
      where: { email: 'pay_admin@example.com' },
      update: {},
      create: {
        name: 'Payment Admin',
        email: 'pay_admin@example.com',
        passwordHash: 'dummy_hash',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;
    adminToken = signAccessToken({ userId: admin.id, role: 'ADMIN' });
  });

  // Helper to create a reserved order with product and cart
  async function setupReservedOrder(initialStock = 10, buyQty = 2, userId = cashier1Id) {
    const product = await prisma.product.create({
      data: { name: `Payment Test Prod ${crypto.randomUUID()}`, price: 40.0, stock: initialStock - buyQty }, // Stock already decremented at checkout
    });

    const order = await prisma.order.create({
      data: {
        userId,
        status: 'RESERVED',
        totalAmount: 40.0 * buyQty,
        idempotencyKey: `ord-key-${crypto.randomUUID()}`,
        items: {
          create: [{ productId: product.id, quantity: buyQty, unitPrice: 40.0 }],
        },
        reservations: {
          create: [
            {
              productId: product.id,
              quantity: buyQty,
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
          ],
        },
      },
      include: { items: true, reservations: true },
    });

    return { product, order };
  }

  it('1. SUCCESS outcome: Order status -> PAID, stock stays decremented, Payment status -> SUCCESS, Reservation -> FINALIZED', async () => {
    const { product, order } = await setupReservedOrder(10, 2); // Stock is 8

    const idempotencyKey = `pay-key-${crypto.randomUUID()}`;

    const res = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(res.body.data.order.status).toBe('PAID');

    // Verify stock is STILL 8 (NOT restored)
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(8);

    // Verify reservation FINALIZED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('FINALIZED');
  });

  it('2. FAILURE outcome: Order status -> FAILED, stock RESTORED (+qty), Payment status -> FAILED, Reservation -> RELEASED', async () => {
    const { product, order } = await setupReservedOrder(10, 3); // Initial stock remaining = 7

    const idempotencyKey = `pay-key-${crypto.randomUUID()}`;

    const res = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'FAILURE', idempotencyKey });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FAILED');
    expect(res.body.data.order.status).toBe('FAILED');

    // Verify stock RESTORED from 7 to 10
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(10);

    // Verify reservation RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
  });

  it('3. TIMEOUT outcome: Order status -> EXPIRED, stock RESTORED (+qty), Payment status -> TIMEOUT, Reservation -> RELEASED', async () => {
    const { product, order } = await setupReservedOrder(5, 2); // Initial stock remaining = 3

    const idempotencyKey = `pay-key-${crypto.randomUUID()}`;

    const res = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'TIMEOUT', idempotencyKey });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TIMEOUT');
    expect(res.body.data.order.status).toBe('EXPIRED');

    // Verify stock RESTORED from 3 to 5
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(5);

    // Verify reservation RELEASED
    const resv = await prisma.reservation.findFirst({ where: { orderId: order.id } });
    expect(resv?.status).toBe('RELEASED');
  });

  it('4. Attempting payment on non-RESERVED order (e.g. already PAID) is rejected with 409 Conflict', async () => {
    const { order } = await setupReservedOrder(10, 1);

    // First payment -> SUCCESS (Order becomes PAID)
    await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey: `pay-key-${crypto.randomUUID()}` });

    // Second payment attempt with NEW idempotencyKey on now-PAID order
    const res = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey: `pay-key-${crypto.randomUUID()}` });

    expect(res.status).toBe(409);
  });

  it('5. Sequential duplicate payment call with SAME idempotencyKey returns same Payment row without duplicating', async () => {
    const { order } = await setupReservedOrder(10, 1);
    const idempotencyKey = `pay-key-${crypto.randomUUID()}`;

    // First payment request
    const res1 = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey });

    expect(res1.status).toBe(200);
    const pay1Id = res1.body.data.id;

    // Second payment request with SAME idempotencyKey
    const res2 = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey });

    expect(res2.status).toBe(200);
    expect(res2.body.data.id).toBe(pay1Id);

    // Verify only ONE Payment row exists in DB
    const paymentRows = await prisma.payment.findMany({ where: { orderId: order.id } });
    expect(paymentRows).toHaveLength(1);
  });

  it('6. Authorization: Cashier 2 CANNOT pay for Cashier 1 order (403), but ADMIN CAN (200)', async () => {
    const { order } = await setupReservedOrder(10, 1, cashier1Id);

    // Cashier 2 tries to pay -> 403 Forbidden
    const resForbidden = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${cashier2Token}`)
      .send({ outcome: 'SUCCESS', idempotencyKey: `pay-key-${crypto.randomUUID()}` });

    expect(resForbidden.status).toBe(403);

    // Admin tries to pay -> 200 OK
    const resAdmin = await request(app)
      .post(`/api/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'SUCCESS', idempotencyKey: `pay-key-${crypto.randomUUID()}` });

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.data.order.status).toBe('PAID');
  });

  it('7. CONCURRENCY PROOF: Race 2 concurrent payment calls for the same order -> exactly 1 Payment row exists, order lands in 1 terminal state', async () => {
    const { product, order } = await setupReservedOrder(10, 2); // Buy 2, stock = 8

    const key1 = `conc-pay-${crypto.randomUUID()}`;
    const key2 = `conc-pay-${crypto.randomUUID()}`;

    console.log('\n🚀 Firing 2 concurrent payment requests (SUCCESS vs FAILURE) for the same order...');

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ outcome: 'SUCCESS', idempotencyKey: key1 }),
      request(app)
        .post(`/api/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ outcome: 'FAILURE', idempotencyKey: key2 }),
    ]);

    const statuses = [res1.status, res2.status];
    console.log('--- PAYMENT CONCURRENCY TEST OUTPUT ---');
    console.log(`Response Statuses: ${statuses.join(', ')}`);

    const paymentRows = await prisma.payment.findMany({ where: { orderId: order.id } });
    console.log(`Payment Rows in DB: ${paymentRows.length}`);

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    console.log(`Final Order Status: ${finalOrder?.status}`);
    console.log('----------------------------------------\n');

    expect(paymentRows).toHaveLength(1);
    expect(['PAID', 'FAILED']).toContain(finalOrder?.status);
  }, 30000);

  it('8. TRUE CONCURRENT DUPLICATE PAYMENT: 2 concurrent requests with exact same idempotencyKey -> both return 200, same Payment ID, 1 Payment row in DB', async () => {
    const { order } = await setupReservedOrder(10, 2);
    const sameIdempotencyKey = `conc-dup-pay-${crypto.randomUUID()}`;

    console.log('\n🚀 Firing 2 TRUE concurrent duplicate payment requests with the SAME idempotencyKey...');

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ outcome: 'SUCCESS', idempotencyKey: sameIdempotencyKey }),
      request(app)
        .post(`/api/orders/${order.id}/payment`)
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ outcome: 'SUCCESS', idempotencyKey: sameIdempotencyKey }),
    ]);

    console.log('--- CONCURRENT DUPLICATE PAYMENT TEST OUTPUT ---');
    console.log(`Response Status 1: ${res1.status}, Response Status 2: ${res2.status}`);
    console.log(`Payment ID 1: ${res1.body.data?.id}, Payment ID 2: ${res2.body.data?.id}`);
    console.log('-------------------------------------------------\n');

    // Both callers must receive 200 OK
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Both callers must receive the exact same Payment ID
    expect(res1.body.data.id).toBe(res2.body.data.id);

    // Exactly 1 Payment row exists in DB for this order
    const paymentRows = await prisma.payment.findMany({ where: { orderId: order.id } });
    expect(paymentRows).toHaveLength(1);

    // Order status is PAID
    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(finalOrder?.status).toBe('PAID');
  }, 30000);
});
