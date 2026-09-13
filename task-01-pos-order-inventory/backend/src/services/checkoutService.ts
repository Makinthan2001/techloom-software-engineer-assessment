import { prisma } from '../config/index.js';
import PrismaClientPkg from '@prisma/client';
import { stockService, runInStockSafeTransaction } from './stockService.js';

const Prisma = PrismaClientPkg.Prisma;
const OrderStatus = PrismaClientPkg.OrderStatus;
type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];
import { reservationService } from './reservationService.js';
import { transitionOrderStatus } from './orderStateMachine.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../utils/errors.js';

export const checkoutService = {
  /**
   * Processes cart checkout end-to-end within a Serializable database transaction.
   * Enforces ownership, stock availability across all line items, state machine rules, and idempotency.
   */
  async processCheckout(userId: string, cartId: string, idempotencyKey: string) {
    // 1. Idempotency short-circuit BEFORE opening transaction
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: { include: { product: true } },
        reservations: true,
      },
    });

    if (existingOrder) {
      return { order: existingOrder, isExisting: true };
    }

    // 2. Load and validate Cart ownership & state
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) {
      throw new NotFoundError(`Cart with ID '${cartId}' not found`);
    }

    if (cart.userId !== userId) {
      throw new ForbiddenError('You are not authorized to check out this cart');
    }

    if (cart.status !== 'ACTIVE') {
      throw new ConflictError('Cart is no longer active (already converted or checkout in progress)');
    }

    if (cart.items.length === 0) {
      throw new ValidationError('Cannot check out an empty cart');
    }

    try {
      // 3. Execute atomic checkout within Serializable transaction
      const newOrder = await runInStockSafeTransaction(async (tx) => {
        // Double-check idempotency key inside transaction
        const existingTx = await tx.order.findUnique({
          where: { idempotencyKey },
          include: {
            items: { include: { product: true } },
            reservations: true,
          },
        });
        if (existingTx) {
          return existingTx;
        }

        // a. Decrement stock for ALL cart items atomically
        for (const item of cart.items) {
          const success = await stockService.decrementStockIfAvailable(
            tx,
            item.productId,
            item.quantity
          );

          if (!success) {
            throw new ConflictError(
              `Insufficient stock available for product '${item.product.name}' (ID: ${item.productId})`
            );
          }
        }

        // b. Calculate total amount
        const totalAmount = cart.items.reduce(
          (sum, item) => sum + Number(item.product.price) * item.quantity,
          0
        );

        // c. Create Order in PENDING status first
        const createdOrder = await tx.order.create({
          data: {
            userId,
            cartId,
            status: OrderStatus.PENDING,
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
            idempotencyKey,
          },
        });

        // d. Transition status to RESERVED via centralized state machine
        await transitionOrderStatus(
          tx,
          createdOrder.id,
          OrderStatus.PENDING,
          OrderStatus.RESERVED
        );

        // e. Create OrderItems with unitPrice snapshot
        for (const item of cart.items) {
          await tx.orderItem.create({
            data: {
              orderId: createdOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.price,
            },
          });
        }

        // f. Create Reservation records (expiresAt = now + 5m)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        for (const item of cart.items) {
          await reservationService.createReservation(
            tx,
            createdOrder.id,
            item.productId,
            item.quantity,
            expiresAt
          );
        }

        // g. Mark Cart as CONVERTED
        await tx.cart.update({
          where: { id: cartId },
          data: { status: 'CONVERTED' },
        });

        // Return final created order
        return await tx.order.findUnique({
          where: { id: createdOrder.id },
          include: {
            items: { include: { product: true } },
            reservations: true,
          },
        });
      });

      return { order: newOrder!, isExisting: false };
    } catch (err: any) {
      // Handle P2002 race condition on idempotencyKey
      if (err.code === 'P2002' || (err.message && err.message.includes('Unique constraint failed'))) {
        const winningOrder = await prisma.order.findUnique({
          where: { idempotencyKey },
          include: {
            items: { include: { product: true } },
            reservations: true,
          },
        });

        if (winningOrder) {
          return { order: winningOrder, isExisting: true };
        }
      }

      throw err;
    }
  },
};
