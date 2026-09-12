import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import crypto from 'crypto';

describe('Checkout Flow Integration Tests (POST /api/checkout)', { timeout: 30000 }, () => {
  let cashier1Token: string;
  let cashier1Id: string;
  let cashier2Token: string;
  let cashier2Id: string;

  beforeAll(async () => {
    // Seed test cashiers
    const user1 = await prisma.user.upsert({
      where: { email: 'checkout_cashier1@example.com' },
      update: {},
      create: {
        name: 'Checkout Cashier 1',
        email: 'checkout_cashier1@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier1Id = user1.id;
    cashier1Token = signAccessToken({ userId: user1.id, role: 'CASHIER' });

    const user2 = await prisma.user.upsert({
      where: { email: 'checkout_cashier2@example.com' },
      update: {},
      create: {
        name: 'Checkout Cashier 2',
        email: 'checkout_cashier2@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    cashier2Id = user2.id;
    cashier2Token = signAccessToken({ userId: user2.id, role: 'CASHIER' });
  });

  it('1. Happy path: sufficient stock -> Order created RESERVED, stock decremented, reservations created, cart CONVERTED', async () => {
    const product = await prisma.product.create({
      data: { name: 'Checkout Test Prod 1', price: 25.0, stock: 10 },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: {
          create: [{ productId: product.id, quantity: 2 }],
        },
      },
    });

    const idempotencyKey = `chk-key-${crypto.randomUUID()}`;

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ cartId: cart.id, idempotencyKey });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const order = res.body.data;
    expect(order.status).toBe('RESERVED');
    expect(order.userId).toBe(cashier1Id);
    expect(Number(order.totalAmount)).toBe(50);
    expect(order.items).toHaveLength(1);
    expect(Number(order.items[0].unitPrice)).toBe(25);
    expect(order.reservations).toHaveLength(1);
    expect(order.reservations[0].status).toBe('ACTIVE');

    // Verify stock decremented from 10 to 8
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(8);

    // Verify cart status CONVERTED
    const updatedCart = await prisma.cart.findUnique({ where: { id: cart.id } });
    expect(updatedCart?.status).toBe('CONVERTED');
  });

  it('2. Insufficient stock -> 409 Conflict, no Order created, stock unchanged', async () => {
    const product = await prisma.product.create({
      data: { name: 'Checkout Insufficient Stock Prod', price: 100.0, stock: 3 },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: {
          create: [{ productId: product.id, quantity: 5 }], // requesting 5 from stock 3
        },
      },
    });

    const idempotencyKey = `chk-key-${crypto.randomUUID()}`;

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ cartId: cart.id, idempotencyKey });

    expect(res.status).toBe(409);

    // Confirm no Order row exists for this idempotencyKey
    const orderCheck = await prisma.order.findUnique({ where: { idempotencyKey } });
    expect(orderCheck).toBeNull();

    // Confirm stock unchanged
    const prodCheck = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodCheck?.stock).toBe(3);

    // Confirm cart remains ACTIVE
    const cartCheck = await prisma.cart.findUnique({ where: { id: cart.id } });
    expect(cartCheck?.status).toBe('ACTIVE');
  });

  it('3. Sequential duplicate checkout with same idempotencyKey returns same Order, stock decremented only once', async () => {
    const product = await prisma.product.create({
      data: { name: 'Checkout Idempotency Prod', price: 15.0, stock: 10 },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: {
          create: [{ productId: product.id, quantity: 2 }],
        },
      },
    });

    const idempotencyKey = `chk-key-${crypto.randomUUID()}`;

    // First checkout call
    const res1 = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ cartId: cart.id, idempotencyKey });

    expect(res1.status).toBe(200);
    const order1Id = res1.body.data.id;

    // Second checkout call with SAME idempotencyKey
    const res2 = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({ cartId: cart.id, idempotencyKey });

    expect(res2.status).toBe(200);
    expect(res2.body.data.id).toBe(order1Id);

    // Stock decremented only ONCE (10 - 2 = 8)
    const prodCheck = await prisma.product.findUnique({ where: { id: product.id } });
    expect(prodCheck?.stock).toBe(8);
  });

  it('4. Ownership check: Cashier 2 CANNOT check out Cashier 1 cart (403 Forbidden)', async () => {
    const product = await prisma.product.create({
      data: { name: 'Cart Ownership Prod', price: 20.0, stock: 10 },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: {
          create: [{ productId: product.id, quantity: 1 }],
        },
      },
    });

    const res = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${cashier2Token}`) // Cashier 2 trying to check out Cashier 1's cart
      .send({ cartId: cart.id, idempotencyKey: `chk-key-${crypto.randomUUID()}` });

    expect(res.status).toBe(403);
  });

  it('5. CONCURRENCY PROOF: 2 concurrent checkout requests for 4 units each against stock = 5 -> exactly 1 succeeds, 1 fails (409), final stock = 1', async () => {
    const product = await prisma.product.create({
      data: { name: 'Checkout Concurrency Prod', price: 30.0, stock: 5 },
    });

    // Create 2 separate carts owned by Cashier 1 and Cashier 2, each wanting 4 units of product
    const cart1 = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: { create: [{ productId: product.id, quantity: 4 }] },
      },
    });

    const cart2 = await prisma.cart.create({
      data: {
        userId: cashier2Id,
        status: 'ACTIVE',
        items: { create: [{ productId: product.id, quantity: 4 }] },
      },
    });

    const key1 = `conc-chk-${crypto.randomUUID()}`;
    const key2 = `conc-chk-${crypto.randomUUID()}`;

    console.log('\n🚀 Firing 2 concurrent checkout requests for 4 units each against stock = 5...');

    // Fire both checkout requests concurrently
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ cartId: cart1.id, idempotencyKey: key1 }),
      request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${cashier2Token}`)
        .send({ cartId: cart2.id, idempotencyKey: key2 }),
    ]);

    const statuses = [res1.status, res2.status];
    console.log('--- CHECKOUT CONCURRENCY TEST OUTPUT ---');
    console.log(`Initial Stock: 5 (Requests: 2 carts of 4 units)`);
    console.log(`Response Statuses: ${statuses.join(', ')}`);

    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Final Stock: ${updatedProd?.stock}`);
    console.log('----------------------------------------\n');

    expect(statuses.sort()).toEqual([200, 409]);
    expect(updatedProd?.stock).toBe(1); // 5 - 4 = 1
  }, 30000);

  it('6. TRUE CONCURRENT DUPLICATE CHECKOUT: 2 concurrent requests with exact same idempotencyKey -> both return 200, same Order ID, stock decremented once', async () => {
    const product = await prisma.product.create({
      data: { name: 'Concurrent Duplicate Checkout Prod', price: 50.0, stock: 10 },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: cashier1Id,
        status: 'ACTIVE',
        items: {
          create: [{ productId: product.id, quantity: 2 }],
        },
      },
    });

    const sameIdempotencyKey = `conc-dup-chk-${crypto.randomUUID()}`;

    console.log('\n🚀 Firing 2 TRUE concurrent duplicate checkout requests with the SAME idempotencyKey...');

    // Fire 2 concurrent requests with exact same cartId and exact same idempotencyKey
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ cartId: cart.id, idempotencyKey: sameIdempotencyKey }),
      request(app)
        .post('/api/checkout')
        .set('Authorization', `Bearer ${cashier1Token}`)
        .send({ cartId: cart.id, idempotencyKey: sameIdempotencyKey }),
    ]);

    console.log('--- CONCURRENT DUPLICATE CHECKOUT TEST OUTPUT ---');
    console.log(`Response Status 1: ${res1.status}, Response Status 2: ${res2.status}`);
    console.log(`Order ID 1: ${res1.body.data?.id}, Order ID 2: ${res2.body.data?.id}`);
    console.log('--------------------------------------------------\n');

    // Both callers must receive 200 OK
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Both callers must receive the exact same Order ID
    expect(res1.body.data.id).toBe(res2.body.data.id);

    // Exactly 1 Order row exists in DB for this idempotency key
    const orderRows = await prisma.order.findMany({ where: { idempotencyKey: sameIdempotencyKey } });
    expect(orderRows).toHaveLength(1);

    // Stock decremented only once (10 - 2 = 8)
    const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.stock).toBe(8);
  }, 30000);
});
