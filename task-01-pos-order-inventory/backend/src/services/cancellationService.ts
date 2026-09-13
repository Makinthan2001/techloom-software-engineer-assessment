import { prisma } from '../config/index.js';
import PrismaClientPkg from '@prisma/client';
import { runInStockSafeTransaction } from './stockService.js';

const { OrderStatus } = PrismaClientPkg;
import { reservationService } from './reservationService.js';
import { transitionOrderStatus } from './orderStateMachine.js';
import {
  NotFoundError,
  ForbiddenError,
  InvalidStateTransitionError,
} from '../utils/errors.js';

export const cancellationService = {
  /**
   * Cancels an order from RESERVED or PAID status, releasing reservations and restoring stock atomically.
   * Enforces RBAC ownership rules, state machine transitions, and idempotency.
   */
  async cancelOrder(orderId: string, userId: string, role: string) {
    // 1. Fetch order for fast-path validation
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        reservations: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order with ID '${orderId}' not found`);
    }

    // 2. Authorization check: Owner or ADMIN allowed
    if (order.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenError('You are not authorized to cancel this order');
    }

    // 3. Idempotent short-circuit: If already CANCELLED, return current state immediately (200 OK no-op)
    if (order.status === OrderStatus.CANCELLED) {
      return { order, isExisting: true };
    }

    // 4. Precondition check: Only RESERVED or PAID orders can be cancelled per state machine
    if (order.status !== OrderStatus.RESERVED && order.status !== OrderStatus.PAID) {
      throw new InvalidStateTransitionError(
        `Cannot cancel order with status '${order.status}'. Cancellation is only permitted for RESERVED or PAID orders.`
      );
    }

    try {
      // 5. Execute cancellation within a Serializable transaction
      const updatedOrder = await runInStockSafeTransaction(async (tx) => {
        // Re-verify order status inside transaction
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { product: true } },
            reservations: true,
          },
        });

        if (!currentOrder) {
          throw new NotFoundError(`Order with ID '${orderId}' not found`);
        }

        // Double-check idempotency inside transaction
        if (currentOrder.status === OrderStatus.CANCELLED) {
          return currentOrder;
        }

        if (currentOrder.status === OrderStatus.RESERVED) {
          // Release ACTIVE reservations (ACTIVE -> RELEASED) and restore stock
          await reservationService.releaseAllOrderReservations(tx, orderId);

          // Transition order status RESERVED -> CANCELLED via state machine
          await transitionOrderStatus(
            tx,
            orderId,
            OrderStatus.RESERVED,
            OrderStatus.CANCELLED
          );
        } else if (currentOrder.status === OrderStatus.PAID) {
          // Release FINALIZED reservations (FINALIZED -> RELEASED) and restore stock
          await reservationService.releaseAllFinalizedOrderReservations(tx, orderId);

          // Transition order status PAID -> CANCELLED via state machine
          await transitionOrderStatus(
            tx,
            orderId,
            OrderStatus.PAID,
            OrderStatus.CANCELLED
          );
        } else {
          throw new InvalidStateTransitionError(
            `Cannot cancel order with status '${currentOrder.status}'`
          );
        }

        return await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { product: true } },
            reservations: true,
          },
        });
      });

      return { order: updatedOrder!, isExisting: false };
    } catch (err: any) {
      // Re-fetch order: if a concurrent request already cancelled it, return the cancelled order state
      const finalCheck = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          reservations: true,
        },
      });

      if (finalCheck && finalCheck.status === OrderStatus.CANCELLED) {
        return { order: finalCheck, isExisting: true };
      }

      throw err;
    }
  },
};
