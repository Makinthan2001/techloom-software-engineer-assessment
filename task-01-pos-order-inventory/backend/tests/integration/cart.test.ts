import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { hashPassword } from '../../src/utils/password.js';

const request = supertest(app);

describe('Cart Endpoints Integration Tests', () => {
  let cashier1Token: string;
  let cashier2Token: string;
  let cashier1Id: string;
  let cashier2Id: string;

  let product1Id: string;
  let product2Id: string;
  let cart1Id: string;
  let cart1ItemId: string;

  beforeAll(async () => {
    // Seed two Cashier accounts
    const passwordHash = await hashPassword('CashierPass123!');

    const cashier1 = await prisma.user.upsert({
      where: { email: 'cart_cashier1@techloom.ai' },
      update: {},
      create: {
        name: 'Cart Cashier One',
        email: 'cart_cashier1@techloom.ai',
        passwordHash,
        role: 'CASHIER',
      },
    });
    cashier1Id = cashier1.id;

    const cashier2 = await prisma.user.upsert({
      where: { email: 'cart_cashier2@techloom.ai' },
      update: {},
      create: {
        name: 'Cart Cashier Two',
        email: 'cart_cashier2@techloom.ai',
        passwordHash,
        role: 'CASHIER',
      },
    });
    cashier2Id = cashier2.id;

    cashier1Token = signAccessToken({ userId: cashier1Id, role: 'CASHIER' });
    cashier2Token = signAccessToken({ userId: cashier2Id, role: 'CASHIER' });

    // Seed test products
    const p1 = await prisma.product.create({
      data: { name: 'Cart Test Item 1', price: 15.5, stock: 50 },
    });
    product1Id = p1.id;

    const p2 = await prisma.product.create({
      data: { name: 'Cart Test Item 2', price: 25.0, stock: 30 },
    });
    product2Id = p2.id;
  });

  it('1. Cashier 1 can create a cart', async () => {
    const res = await request
      .post('/api/carts')
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(cashier1Id);
    expect(res.body.data.status).toBe('ACTIVE');

    cart1Id = res.body.data.id;
  });

  it('2. Cashier 1 can add an item to their cart', async () => {
    const res = await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        productId: product1Id,
        quantity: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productId).toBe(product1Id);
    expect(res.body.data.quantity).toBe(2);

    cart1ItemId = res.body.data.id;
  });

  it('3. Adding the same product twice updates quantity via UPSERT (does not duplicate row)', async () => {
    const res = await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        productId: product1Id,
        quantity: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantity).toBe(5); // 2 + 3 = 5

    // Verify database only has 1 line item for this cart
    const cartDb = await prisma.cart.findUnique({
      where: { id: cart1Id },
      include: { items: true },
    });
    expect(cartDb?.items.length).toBe(1);
    expect(cartDb?.items[0]?.quantity).toBe(5);
  });

  it('4. Cashier 1 can view their cart with computed subtotals and totalAmount', async () => {
    // Add product 2 as well
    await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        productId: product2Id,
        quantity: 1,
      });

    const res = await request
      .get(`/api/carts/${cart1Id}`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(2);

    // Subtotal 1 = 15.50 * 5 = 77.50
    // Subtotal 2 = 25.00 * 1 = 25.00
    // Running total = 102.50
    expect(res.body.data.totalAmount).toBe(102.5);
  });

  it('5. Cashier 1 can update cart item quantity', async () => {
    const res = await request
      .patch(`/api/carts/${cart1Id}/items/${cart1ItemId}`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        quantity: 4,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantity).toBe(4);
  });

  it('6. Cashier 2 CANNOT view Cashier 1 cart (403 Forbidden)', async () => {
    const res = await request
      .get(`/api/carts/${cart1Id}`)
      .set('Authorization', `Bearer ${cashier2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('7. Cashier 2 CANNOT add/modify/remove items in Cashier 1 cart (403 Forbidden)', async () => {
    const resAdd = await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier2Token}`)
      .send({
        productId: product1Id,
        quantity: 1,
      });
    expect(resAdd.status).toBe(403);

    const resUpdate = await request
      .patch(`/api/carts/${cart1Id}/items/${cart1ItemId}`)
      .set('Authorization', `Bearer ${cashier2Token}`)
      .send({ quantity: 10 });
    expect(resUpdate.status).toBe(403);

    const resDelete = await request
      .delete(`/api/carts/${cart1Id}/items/${cart1ItemId}`)
      .set('Authorization', `Bearer ${cashier2Token}`);
    expect(resDelete.status).toBe(403);
  });

  it('8. Adding non-existent product ID returns 404 Not Found', async () => {
    const res = await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        productId: '00000000-0000-0000-0000-000000000000',
        quantity: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('9. Invalid productId or quantity returns 422 Unprocessable Entity', async () => {
    const res = await request
      .post(`/api/carts/${cart1Id}/items`)
      .set('Authorization', `Bearer ${cashier1Token}`)
      .send({
        productId: 'invalid-id',
        quantity: -1,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('10. Invalid UUID for cartId returns 400 Bad Request', async () => {
    const res = await request
      .get('/api/carts/invalid-uuid')
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('11. Cashier 1 can remove item from cart', async () => {
    const res = await request
      .delete(`/api/carts/${cart1Id}/items/${cart1ItemId}`)
      .set('Authorization', `Bearer ${cashier1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request
      .get(`/api/carts/${cart1Id}`)
      .set('Authorization', `Bearer ${cashier1Token}`);
    expect(getRes.body.data.items.length).toBe(1); // Only product 2 remains
  });
});
