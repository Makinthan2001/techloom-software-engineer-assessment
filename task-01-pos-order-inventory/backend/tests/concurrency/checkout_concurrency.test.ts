import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import crypto from 'crypto';

describe('HTTP Checkout Concurrency Tests (POST /api/checkout)', { timeout: 120000 }, () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'http_concurrency_user@example.com' },
      update: {},
      create: {
        name: 'HTTP Concurrency User',
        email: 'http_concurrency_user@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    userId = user.id;
    userToken = signAccessToken({ userId: user.id, role: 'CASHIER' });
  });

  it('14a. HTTP Concurrency: 2 concurrent checkouts requesting 4 units from stock=5 (5 repetitions)', async () => {
    const NUM_REPETITIONS = 5;
    const reportData: Array<{
      run: number;
      requestsFired: number;
      successes: number;
      failures: number;
      finalStock: number;
    }> = [];

    for (let run = 1; run <= NUM_REPETITIONS; run++) {
      const product = await prisma.product.create({
        data: {
          name: `HTTP Conc Prod 4u Run ${run}-${crypto.randomUUID()}`,
          price: 15.0,
          stock: 5,
        },
      });

      const cart1 = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
          items: { create: [{ productId: product.id, quantity: 4 }] },
        },
      });
      const cart2 = await prisma.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
          items: { create: [{ productId: product.id, quantity: 4 }] },
        },
      });

      const key1 = `chk-conc-4u-1-${run}-${crypto.randomUUID()}`;
      const key2 = `chk-conc-4u-2-${run}-${crypto.randomUUID()}`;

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ cartId: cart1.id, idempotencyKey: key1 }),
        request(app)
          .post('/api/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ cartId: cart2.id, idempotencyKey: key2 }),
      ]);

      const responses = [res1, res2];
      const successes = responses.filter((r) => r.status === 200 || r.status === 201).length;
      const failures = responses.filter((r) => r.status === 409).length;

      const finalProduct = await prisma.product.findUnique({ where: { id: product.id } });
      const finalStock = finalProduct?.stock ?? -1;

      reportData.push({
        run,
        requestsFired: 2,
        successes,
        failures,
        finalStock,
      });

      expect(successes).toBe(1);
      expect(failures).toBe(1);
      expect(finalStock).toBe(1);
    }

    console.log('\n===============================================================');
    console.log('NUMERIC EVIDENCE: ITEM 14a (2 CONCURRENT CHECKOUTS FOR 4 UNITS FROM STOCK 5)');
    console.log('===============================================================');
    console.table(reportData);
  });

  it('14b. HTTP Concurrency: 10 concurrent checkouts requesting 1 unit from stock=5 (5 repetitions)', async () => {
    const NUM_REPETITIONS = 5;
    const reportData: Array<{
      run: number;
      requestsFired: number;
      successes: number;
      failures: number;
      finalStock: number;
    }> = [];

    for (let run = 1; run <= NUM_REPETITIONS; run++) {
      const product = await prisma.product.create({
        data: {
          name: `HTTP Conc Prod 10req Run ${run}-${crypto.randomUUID()}`,
          price: 10.0,
          stock: 5,
        },
      });

      const carts = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          prisma.cart.create({
            data: {
              userId,
              status: 'ACTIVE',
              items: { create: [{ productId: product.id, quantity: 1 }] },
            },
          })
        )
      );

      const reqPromises = carts.map((cart, idx) =>
        request(app)
          .post('/api/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            cartId: cart.id,
            idempotencyKey: `chk-conc-10req-${run}-${idx}-${crypto.randomUUID()}`,
          })
      );

      const responses = await Promise.all(reqPromises);
      const successes = responses.filter((r) => r.status === 200 || r.status === 201).length;
      const failures = responses.filter((r) => r.status === 409).length;

      const finalProduct = await prisma.product.findUnique({ where: { id: product.id } });
      const finalStock = finalProduct?.stock ?? -1;

      reportData.push({
        run,
        requestsFired: 10,
        successes,
        failures,
        finalStock,
      });

      expect(successes).toBe(5);
      expect(failures).toBe(5);
      expect(finalStock).toBe(0);
    }

    console.log('\n===============================================================');
    console.log('NUMERIC EVIDENCE: ITEM 14b (10 CONCURRENT CHECKOUTS FOR 1 UNIT FROM STOCK 5)');
    console.log('===============================================================');
    console.table(reportData);
  });
});
