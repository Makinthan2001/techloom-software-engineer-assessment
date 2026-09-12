import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { hashPassword } from '../../src/utils/password.js';

const request = supertest(app);

describe('Products Endpoints Integration Tests', () => {
  let adminToken: string;
  let cashierToken: string;
  let adminUserId: string;
  let cashierUserId: string;
  let testProductId: string;

  beforeAll(async () => {
    // Seed test Admin and Cashier
    const adminHash = await hashPassword('AdminPass123!');
    const cashierHash = await hashPassword('CashierPass123!');

    const admin = await prisma.user.upsert({
      where: { email: 'prod_admin@techloom.ai' },
      update: {},
      create: {
        name: 'Product Admin',
        email: 'prod_admin@techloom.ai',
        passwordHash: adminHash,
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    const cashier = await prisma.user.upsert({
      where: { email: 'prod_cashier@techloom.ai' },
      update: {},
      create: {
        name: 'Product Cashier',
        email: 'prod_cashier@techloom.ai',
        passwordHash: cashierHash,
        role: 'CASHIER',
      },
    });
    cashierUserId = cashier.id;

    adminToken = signAccessToken({ userId: adminUserId, role: 'ADMIN' });
    cashierToken = signAccessToken({ userId: cashierUserId, role: 'CASHIER' });
  });

  it('1. ADMIN can create a product', async () => {
    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Wireless Mouse',
        price: 29.99,
        stock: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Wireless Mouse');
    expect(Number(res.body.data.price)).toBe(29.99);
    expect(res.body.data.stock).toBe(100);

    testProductId = res.body.data.id;
  });

  it('2. CASHIER receives 403 Forbidden on product creation', async () => {
    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        name: 'Mechanical Keyboard',
        price: 89.99,
        stock: 20,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('3. CASHIER receives 403 Forbidden on product update', async () => {
    const res = await request
      .patch(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        price: 25.0,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('4. CASHIER receives 403 Forbidden on product deletion', async () => {
    const res = await request
      .delete(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('5. Both ADMIN and CASHIER can list all products', async () => {
    const resCashier = await request
      .get('/api/products')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(resCashier.status).toBe(200);
    expect(resCashier.body.success).toBe(true);
    expect(Array.isArray(resCashier.body.data)).toBe(true);

    const resAdmin = await request
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
  });

  it('6. Both ADMIN and CASHIER can get product details by ID', async () => {
    const res = await request
      .get(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testProductId);
    expect(res.body.data.stock).toBe(100);
  });

  it('7. Both ADMIN and CASHIER can view product stock directly', async () => {
    const res = await request
      .get(`/api/products/${testProductId}/stock`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productId).toBe(testProductId);
    expect(res.body.data.stock).toBe(100);
  });

  it('8. ADMIN can update product details', async () => {
    const res = await request
      .patch(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Wireless Gaming Mouse',
        price: 34.99,
        stock: 80,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Wireless Gaming Mouse');
    expect(Number(res.body.data.price)).toBe(34.99);
    expect(res.body.data.stock).toBe(80);
  });

  it('9. Invalid/non-UUID :id returns 400 Bad Request', async () => {
    const res = await request
      .get('/api/products/not-a-valid-uuid')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('10. Non-existent UUID :id returns 404 Not Found', async () => {
    const res = await request
      .get('/api/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('11. Invalid input body returns 422 Unprocessable Entity', async () => {
    const res = await request
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '',
        price: -10,
        stock: -5,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('12. Deleting a product referenced by an OrderItem is blocked with 409 Conflict', async () => {
    // Create a product to reference
    const p = await prisma.product.create({
      data: { name: 'Referenced Item', price: 10.0, stock: 5 },
    });

    // Create a order and orderItem referencing this product
    const order = await prisma.order.create({
      data: {
        userId: cashierUserId,
        status: 'PAID',
        totalAmount: 10.0,
        idempotencyKey: 'test-order-ref-key-1',
        items: {
          create: {
            productId: p.id,
            quantity: 1,
            unitPrice: 10.0,
          },
        },
      },
    });

    const res = await request
      .delete(`/api/products/${p.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('referenced in existing orders');

    // Clean up test order & item & product
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: p.id } });
  });

  it('13. ADMIN can delete an unreferenced product', async () => {
    const res = await request
      .delete(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request
      .get(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });
});
