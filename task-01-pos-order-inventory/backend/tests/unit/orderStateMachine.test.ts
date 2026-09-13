import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import PrismaClientPkg from '@prisma/client';

const { OrderStatus } = PrismaClientPkg;
type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
import {
  transitionOrderStatus,
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
} from '../../src/services/orderStateMachine.js';
import { InvalidStateTransitionError } from '../../src/utils/errors.js';
import crypto from 'crypto';

describe('Order State Machine Tests', { timeout: 30000 }, () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for order creation
    const user = await prisma.user.upsert({
      where: { email: 'statemachine_test@example.com' },
      update: {},
      create: {
        name: 'State Machine Tester',
        email: 'statemachine_test@example.com',
        passwordHash: 'dummy_hash',
        role: 'CASHIER',
      },
    });
    testUserId = user.id;
  });

  // Helper to create an order in a specific status
  async function createTestOrder(initialStatus: OrderStatus) {
    return await prisma.order.create({
      data: {
        userId: testUserId,
        status: initialStatus,
        totalAmount: 50.0,
        idempotencyKey: `sm-key-${crypto.randomUUID()}`,
      },
    });
  }

  describe('Adjacency List & Transition Helper Verification', () => {
    it('defines the correct allowed transitions map', () => {
      expect(ALLOWED_TRANSITIONS).toEqual({
        PENDING: [OrderStatus.RESERVED],
        RESERVED: [
          OrderStatus.PAID,
          OrderStatus.FAILED,
          OrderStatus.EXPIRED,
          OrderStatus.CANCELLED,
        ],
        PAID: [OrderStatus.CANCELLED],
        FAILED: [],
        EXPIRED: [],
        CANCELLED: [],
      });
    });

    it('isTransitionAllowed returns true for valid transitions and false for invalid', () => {
      expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.RESERVED)).toBe(true);
      expect(isTransitionAllowed(OrderStatus.RESERVED, OrderStatus.PAID)).toBe(true);
      expect(isTransitionAllowed(OrderStatus.RESERVED, OrderStatus.FAILED)).toBe(true);
      expect(isTransitionAllowed(OrderStatus.RESERVED, OrderStatus.EXPIRED)).toBe(true);
      expect(isTransitionAllowed(OrderStatus.RESERVED, OrderStatus.CANCELLED)).toBe(true);
      expect(isTransitionAllowed(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);

      // Invalid transitions
      expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.PAID)).toBe(false);
      expect(isTransitionAllowed(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
      expect(isTransitionAllowed(OrderStatus.PAID, OrderStatus.RESERVED)).toBe(false);
      expect(isTransitionAllowed(OrderStatus.FAILED, OrderStatus.PAID)).toBe(false);
    });
  });

  describe('Valid State Transitions (DB-backed)', () => {
    it('1. PENDING -> RESERVED succeeds', async () => {
      const order = await createTestOrder(OrderStatus.PENDING);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.PENDING, OrderStatus.RESERVED);
      });

      expect(result).toBe(OrderStatus.RESERVED);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.RESERVED);
    });

    it('2. RESERVED -> PAID succeeds', async () => {
      const order = await createTestOrder(OrderStatus.RESERVED);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.RESERVED, OrderStatus.PAID);
      });

      expect(result).toBe(OrderStatus.PAID);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.PAID);
    });

    it('3. RESERVED -> FAILED succeeds', async () => {
      const order = await createTestOrder(OrderStatus.RESERVED);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.RESERVED, OrderStatus.FAILED);
      });

      expect(result).toBe(OrderStatus.FAILED);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.FAILED);
    });

    it('4. RESERVED -> EXPIRED succeeds', async () => {
      const order = await createTestOrder(OrderStatus.RESERVED);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.RESERVED, OrderStatus.EXPIRED);
      });

      expect(result).toBe(OrderStatus.EXPIRED);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.EXPIRED);
    });

    it('5. RESERVED -> CANCELLED succeeds', async () => {
      const order = await createTestOrder(OrderStatus.RESERVED);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.RESERVED, OrderStatus.CANCELLED);
      });

      expect(result).toBe(OrderStatus.CANCELLED);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.CANCELLED);
    });

    it('6. PAID -> CANCELLED succeeds', async () => {
      const order = await createTestOrder(OrderStatus.PAID);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(tx, order.id, OrderStatus.PAID, OrderStatus.CANCELLED);
      });

      expect(result).toBe(OrderStatus.CANCELLED);
      const updated = await prisma.order.findUnique({ where: { id: order.id } });
      expect(updated?.status).toBe(OrderStatus.CANCELLED);
    });

    it('7. Accepts array of allowedFromStates if current status matches one of them', async () => {
      const order = await createTestOrder(OrderStatus.RESERVED);

      const result = await prisma.$transaction(async (tx) => {
        return transitionOrderStatus(
          tx,
          order.id,
          [OrderStatus.RESERVED, OrderStatus.PAID],
          OrderStatus.CANCELLED
        );
      });

      expect(result).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Exhaustive Invalid State Transitions (DB-backed)', () => {
    const allStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.RESERVED,
      OrderStatus.PAID,
      OrderStatus.FAILED,
      OrderStatus.EXPIRED,
      OrderStatus.CANCELLED,
    ];

    const validPairs = new Set([
      `${OrderStatus.PENDING}->${OrderStatus.RESERVED}`,
      `${OrderStatus.RESERVED}->${OrderStatus.PAID}`,
      `${OrderStatus.RESERVED}->${OrderStatus.FAILED}`,
      `${OrderStatus.RESERVED}->${OrderStatus.EXPIRED}`,
      `${OrderStatus.RESERVED}->${OrderStatus.CANCELLED}`,
      `${OrderStatus.PAID}->${OrderStatus.CANCELLED}`,
    ]);

    // Test matrix of all invalid state pairs
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        const pair = `${from}->${to}`;
        if (validPairs.has(pair)) continue;

        it(`Rejects invalid transition ${pair} with InvalidStateTransitionError (409)`, async () => {
          const order = await createTestOrder(from);

          await expect(
            prisma.$transaction(async (tx) => {
              return transitionOrderStatus(tx, order.id, from, to);
            })
          ).rejects.toThrow(InvalidStateTransitionError);

          // Verify order status was NOT changed in DB
          const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
          expect(unchanged?.status).toBe(from);
        });
      }
    }

    it('Rejects transition when order is not in expected allowedFromStates (mismatched actual state)', async () => {
      // Order is in PAID state, but caller claims expected state is RESERVED
      const order = await createTestOrder(OrderStatus.PAID);

      await expect(
        prisma.$transaction(async (tx) => {
          // RESERVED -> CANCELLED is allowed in adjacency map, but order is actually PAID in DB!
          return transitionOrderStatus(tx, order.id, OrderStatus.RESERVED, OrderStatus.CANCELLED);
        })
      ).rejects.toThrow(InvalidStateTransitionError);

      const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
      expect(unchanged?.status).toBe(OrderStatus.PAID);
    });

    it('Rejects transition on non-existent orderId with InvalidStateTransitionError', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          return transitionOrderStatus(
            tx,
            '00000000-0000-0000-0000-000000000000',
            OrderStatus.PENDING,
            OrderStatus.RESERVED
          );
        })
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });
});
