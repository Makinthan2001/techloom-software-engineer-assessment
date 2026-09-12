import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  refreshSchema,
  productCreateSchema,
  productUpdateSchema,
  cartItemSchema,
  checkoutSchema,
  paymentSchema,
} from '../../src/validators/index.js';

describe('Validation Schemas Unit Tests', () => {
  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'cashier@techloom.ai',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email address', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Invalid email address format');
      }
    });

    it('rejects short password', () => {
      const result = loginSchema.safeParse({
        email: 'admin@techloom.ai',
        password: '123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Password must be at least 6 characters long');
      }
    });
  });

  describe('refreshSchema', () => {
    it('accepts valid refreshToken string', () => {
      const result = refreshSchema.safeParse({ refreshToken: 'valid-token-string' });
      expect(result.success).toBe(true);
    });

    it('rejects empty refreshToken', () => {
      const result = refreshSchema.safeParse({ refreshToken: '  ' });
      expect(result.success).toBe(false);
    });
  });

  describe('productCreateSchema & productUpdateSchema', () => {
    it('accepts valid product creation data', () => {
      const result = productCreateSchema.safeParse({
        name: 'Coffee Mug',
        price: 12.99,
        stock: 50,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative stock or price <= 0', () => {
      const res1 = productCreateSchema.safeParse({
        name: 'Item',
        price: -5,
        stock: 10,
      });
      expect(res1.success).toBe(false);

      const res2 = productCreateSchema.safeParse({
        name: 'Item',
        price: 10,
        stock: -1,
      });
      expect(res2.success).toBe(false);
    });

    it('accepts partial valid product updates', () => {
      const result = productUpdateSchema.safeParse({ price: 15.5 });
      expect(result.success).toBe(true);
    });

    it('rejects empty product update object', () => {
      const result = productUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('cartItemSchema', () => {
    it('accepts valid productId UUID and positive quantity', () => {
      const result = cartItemSchema.safeParse({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 2,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID productId or quantity <= 0', () => {
      const res1 = cartItemSchema.safeParse({
        productId: 'invalid-id',
        quantity: 2,
      });
      expect(res1.success).toBe(false);

      const res2 = cartItemSchema.safeParse({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 0,
      });
      expect(res2.success).toBe(false);
    });
  });

  describe('checkoutSchema', () => {
    it('accepts valid cartId UUID and non-empty idempotencyKey', () => {
      const result = checkoutSchema.safeParse({
        cartId: '123e4567-e89b-12d3-a456-426614174000',
        idempotencyKey: 'key-12345',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid cartId UUID', () => {
      const result = checkoutSchema.safeParse({
        cartId: 'bad-uuid',
        idempotencyKey: 'key-12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paymentSchema', () => {
    it('accepts valid payment outcome (SUCCESS, FAILURE, TIMEOUT)', () => {
      for (const outcome of ['SUCCESS', 'FAILURE', 'TIMEOUT']) {
        const result = paymentSchema.safeParse({
          outcome,
          idempotencyKey: 'pay-key-1',
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid payment outcome string', () => {
      const result = paymentSchema.safeParse({
        outcome: 'PENDING',
        idempotencyKey: 'pay-key-1',
      });
      expect(result.success).toBe(false);
    });
  });
});
