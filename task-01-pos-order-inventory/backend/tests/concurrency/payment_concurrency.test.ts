import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import crypto from 'crypto';

describe('HTTP Payment Concurrency Tests (POST /api/orders/:id/payment)', { timeout: 120000 }, () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'payment_concurrency_user@example.com' },
      update: {},
      create: {
        name: 'Payment Concurrency User',
        email: 'payment_concurrency_user@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    userId = user.id;
    userToken = signAccessToken({ userId: user.id, role: 'CASHIER' });
  });

  async function createReservedOrder() {
    const product = await prisma.product.create({
      data: {
        name: `Payment Conc Product ${crypto.randomUUID()}`,
        price: 50.0,
        stock: 20,
      },
    });

    const cart = await prisma.cart.create({
      data: {
        userId,
        status: 'ACTIVE',
        items: { create: [{ productId: product.id, quantity: 2 }] },
      },
    });

    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        cartId: cart.id,
        idempotencyKey: `chk-setup-${crypto.randomUUID()}`,
      });

    return checkoutRes.body.data;
  }

  it('15a. Concurrency: 2 payment calls with DIFFERENT idempotency keys (5 repetitions)', async () => {
    const NUM_REPETITIONS = 5;
    const reportData: Array<{
      run: number;
      requestsFired: number;
      successStatus200: number;
      conflictStatus409: number;
      paymentRowsInDB: number;
      finalOrderStatus: string;
    }> = [];

    for (let run = 1; run <= NUM_REPETITIONS; run++) {
      const order = await createReservedOrder();

      const key1 = `pay-diff-key1-${run}-${crypto.randomUUID()}`;
      const key2 = `pay-diff-key2-${run}-${crypto.randomUUID()}`;

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/orders/${order.id}/payment`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ outcome: 'SUCCESS', idempotencyKey: key1 }),
        request(app)
          .post(`/api/orders/${order.id}/payment`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ outcome: 'SUCCESS', idempotencyKey: key2 }),
      ]);

      const responses = [res1, res2];
      const successStatus200 = responses.filter((r) => r.status === 200).length;
      const conflictStatus409 = responses.filter((r) => r.status === 409).length;

      const paymentRows = await prisma.payment.findMany({ where: { orderId: order.id } });
      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });

      reportData.push({
        run,
        requestsFired: 2,
        successStatus200,
        conflictStatus409,
        paymentRowsInDB: paymentRows.length,
        finalOrderStatus: updatedOrder?.status ?? 'UNKNOWN',
      });

      expect(paymentRows.length).toBe(1);
      expect(successStatus200).toBe(1);
      expect(conflictStatus409).toBe(1);
      expect(updatedOrder?.status).toBe('PAID');
    }

    console.log('\n===============================================================');
    console.log('NUMERIC EVIDENCE: ITEM 15a (2 CONCURRENT PAYMENTS WITH DIFFERENT KEYS)');
    console.log('===============================================================');
    console.table(reportData);
  });

  it('15b. Concurrency: 2 payment calls with SAME idempotency key (5 repetitions)', async () => {
    const NUM_REPETITIONS = 5;
    const reportData: Array<{
      run: number;
      requestsFired: number;
      status200Count: number;
      paymentRowsInDB: number;
      matchingPaymentId: boolean;
      finalOrderStatus: string;
    }> = [];

    for (let run = 1; run <= NUM_REPETITIONS; run++) {
      const order = await createReservedOrder();

      const sameKey = `pay-same-key-${run}-${crypto.randomUUID()}`;

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/orders/${order.id}/payment`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ outcome: 'SUCCESS', idempotencyKey: sameKey }),
        request(app)
          .post(`/api/orders/${order.id}/payment`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ outcome: 'SUCCESS', idempotencyKey: sameKey }),
      ]);

      const responses = [res1, res2];
      const status200Count = responses.filter((r) => r.status === 200).length;

      const paymentRows = await prisma.payment.findMany({ where: { orderId: order.id } });
      const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });

      const paymentId1 = res1.body.data.id;
      const paymentId2 = res2.body.data.id;
      const matchingPaymentId = paymentId1 === paymentId2;

      reportData.push({
        run,
        requestsFired: 2,
        status200Count,
        paymentRowsInDB: paymentRows.length,
        matchingPaymentId,
        finalOrderStatus: updatedOrder?.status ?? 'UNKNOWN',
      });

      expect(status200Count).toBe(2);
      expect(paymentRows.length).toBe(1);
      expect(matchingPaymentId).toBe(true);
      expect(updatedOrder?.status).toBe('PAID');
    }

    console.log('\n===============================================================');
    console.log('NUMERIC EVIDENCE: ITEM 15b (2 CONCURRENT PAYMENTS WITH SAME KEY)');
    console.log('===============================================================');
    console.table(reportData);
  });
});
