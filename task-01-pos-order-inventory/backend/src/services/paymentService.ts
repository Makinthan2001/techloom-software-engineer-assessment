import { prisma } from '../config/index.js';
import PrismaClientPkg from '@prisma/client';
import { runInStockSafeTransaction } from './stockService.js';

const OrderStatus = PrismaClientPkg.OrderStatus;
type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

const PaymentStatus = PrismaClientPkg.PaymentStatus;
type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];
import { reservationService } from './reservationService.js';
import { transitionOrderStatus } from './orderStateMachine.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';

export interface PaymentParams {
  orderId: string;
  userId: string;
  role: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
  idempotencyKey: string;
}

export const paymentService = {
  /**
   * Processes mock payment for an order atomically, enforcing RBAC, idempotency, state transitions, and stock restoration.
   */
  async processPayment(params: PaymentParams) {
    const { orderId, userId, role, outcome, idempotencyKey } = params;

    // 1. Idempotency short-circuit BEFORE opening transaction
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { order: true },
    });

    if (existingPayment) {
      return { payment: existingPayment, isExisting: true };
    }

    // 2. Load order and verify existence
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        reservations: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order with ID '${orderId}' not found`);
    }

    // 3. Ownership authorization: Owner or ADMIN allowed
    if (order.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenError('You are not authorized to process payment for this order');
    }

    // 4. Precondition check: Order must be in RESERVED state
    if (order.status !== OrderStatus.RESERVED) {
      throw new ConflictError(
        `Order is not in RESERVED status (current status: ${order.status})`
      );
    }

    // 5. Lazy expiry check: Use shared helper to check if active reservation is past expiresAt
    const wasExpired = await reservationService.expireOrderReservationsIfDueOutsideTx(orderId);
    if (wasExpired) {
      throw new ConflictError('Order reservation has expired');
    }

    // 6. Execute atomic payment transaction
    try {
      const resultPayment = await runInStockSafeTransaction(async (tx) => {
        // Check if payment already exists for this idempotencyKey inside transaction
        const existingTxKey = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: { order: true },
        });
        if (existingTxKey) return existingTxKey;

        let paymentStatus: PaymentStatus;
        let targetOrderStatus: OrderStatus;

        if (outcome === 'SUCCESS') {
          paymentStatus = PaymentStatus.SUCCESS;
          targetOrderStatus = OrderStatus.PAID;

          // Finalize reservations (consumed by sale, stock NOT restored)
          await reservationService.finalizeAllOrderReservations(tx, orderId);
        } else if (outcome === 'FAILURE') {
          paymentStatus = PaymentStatus.FAILED;
          targetOrderStatus = OrderStatus.FAILED;

          // Release reservations and restore stock
          await reservationService.releaseAllOrderReservations(tx, orderId);
        } else {
          // TIMEOUT
          paymentStatus = PaymentStatus.TIMEOUT;
          targetOrderStatus = OrderStatus.EXPIRED;

          // Release reservations and restore stock
          await reservationService.releaseAllOrderReservations(tx, orderId);
        }

        // Transition order status via centralized state machine
        await transitionOrderStatus(
          tx,
          orderId,
          OrderStatus.RESERVED,
          targetOrderStatus
        );

        // Create Payment record
        return await tx.payment.create({
          data: {
            orderId,
            status: paymentStatus,
            idempotencyKey,
            simulatedOutcome: outcome,
          },
          include: { order: true },
        });
      });

      return { payment: resultPayment, isExisting: false };
    } catch (err: any) {
      // Handle P2002 race condition on idempotencyKey or orderId
      if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint failed'))) {
        const winningPayment = await prisma.payment.findFirst({
          where: {
            OR: [{ idempotencyKey }, { orderId }],
          },
          include: { order: true },
        });

        if (winningPayment) {
          return { payment: winningPayment, isExisting: true };
        }
      }

      throw err;
    }
  },
};
