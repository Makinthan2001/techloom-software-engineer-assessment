import { prisma } from '../config/index.js';
import { reservationService } from './reservationService.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export const orderService = {
  /**
   * Retrieves orders based on user role: CASHIER sees own orders only, ADMIN sees all orders.
   */
  async getOrders(userId: string, role: string) {
    const whereClause = role === 'ADMIN' ? {} : { userId };

    return await prisma.order.findMany({
      where: whereClause,
      include: {
        items: { include: { product: true } },
        reservations: true,
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  /**
   * Retrieves a single order by ID with ownership check and lazy reservation expiry on read.
   */
  async getOrderById(orderId: string, userId: string, role: string) {
    // 1. Fetch order
    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        reservations: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order with ID '${orderId}' not found`);
    }

    // 2. Ownership check: Owner or ADMIN allowed
    if (order.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenError('You are not authorized to view this order');
    }

    // 3. Lazy Expiration on Read: If RESERVED, check if active reservation is past due
    if (order.status === 'RESERVED') {
      const wasExpired = await reservationService.expireOrderReservationsIfDueOutsideTx(orderId);
      if (wasExpired) {
        // Re-fetch order to return the updated status (EXPIRED)
        order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { product: true } },
            reservations: true,
            payment: true,
          },
        });
      }
    }

    return order!;
  },
};
