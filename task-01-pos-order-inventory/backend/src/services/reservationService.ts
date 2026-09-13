import { prisma } from '../config/index.js';
import PrismaClientPkg from '@prisma/client';
import { stockService, runInStockSafeTransaction } from './stockService.js';
import { transitionOrderStatus } from './orderStateMachine.js';

const { ReservationStatus, OrderStatus } = PrismaClientPkg;

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const reservationService = {
  /**
   * Creates a new Reservation record tied to an Order and Product.
   */
  async createReservation(
    tx: TransactionClient,
    orderId: string,
    productId: string,
    quantity: number,
    expiresAt: Date
  ) {
    return await tx.reservation.create({
      data: {
        orderId,
        productId,
        quantity,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      },
    });
  },

  /**
   * Idempotently releases a single active reservation.
   * Performs atomic update: UPDATE "Reservation" SET status = 'RELEASED', releasedAt = now() WHERE id = :id AND status = 'ACTIVE'
   * Restores product stock (Product.stock += quantity) ONLY if exactly 1 row was affected.
   * Returns true if released and stock restored; false if already released or finalized.
   */
  async releaseReservation(tx: TransactionClient, reservationId: string): Promise<boolean> {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return false;
    }

    const updateResult = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        status: ReservationStatus.ACTIVE,
      },
      data: {
        status: ReservationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    if (updateResult.count === 1) {
      await stockService.restoreStock(tx, reservation.productId, reservation.quantity);
      return true;
    }

    return false;
  },

  /**
   * Narrow transition allowed ONLY during post-payment (PAID) order cancellation:
   * Performs atomic update: UPDATE "Reservation" SET status = 'RELEASED', releasedAt = now() WHERE id = :id AND status = 'FINALIZED'
   * Restores product stock (Product.stock += quantity) ONLY if exactly 1 row was affected.
   */
  async releaseFinalizedReservation(tx: TransactionClient, reservationId: string): Promise<boolean> {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.status !== ReservationStatus.FINALIZED) {
      return false;
    }

    const updateResult = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        status: ReservationStatus.FINALIZED,
      },
      data: {
        status: ReservationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    if (updateResult.count === 1) {
      await stockService.restoreStock(tx, reservation.productId, reservation.quantity);
      return true;
    }

    return false;
  },

  /**
   * Releases all ACTIVE reservations belonging to an order and restores their stock.
   */
  async releaseAllOrderReservations(tx: TransactionClient, orderId: string): Promise<number> {
    const activeReservations = await tx.reservation.findMany({
      where: {
        orderId,
        status: ReservationStatus.ACTIVE,
      },
    });

    let releasedCount = 0;
    for (const res of activeReservations) {
      const released = await this.releaseReservation(tx, res.id);
      if (released) releasedCount++;
    }

    return releasedCount;
  },

  /**
   * Releases all FINALIZED reservations belonging to an order during post-payment cancellation and restores their stock.
   */
  async releaseAllFinalizedOrderReservations(tx: TransactionClient, orderId: string): Promise<number> {
    const finalizedReservations = await tx.reservation.findMany({
      where: {
        orderId,
        status: ReservationStatus.FINALIZED,
      },
    });

    let releasedCount = 0;
    for (const res of finalizedReservations) {
      const released = await this.releaseFinalizedReservation(tx, res.id);
      if (released) releasedCount++;
    }

    return releasedCount;
  },

  /**
   * Finalizes a single active reservation (consumed by a successful sale).
   * Performs atomic update: UPDATE "Reservation" SET status = 'FINALIZED', releasedAt = now() WHERE id = :id AND status = 'ACTIVE'
   * Product stock is NOT restored.
   */
  async finalizeReservation(tx: TransactionClient, reservationId: string): Promise<boolean> {
    const updateResult = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        status: ReservationStatus.ACTIVE,
      },
      data: {
        status: ReservationStatus.FINALIZED,
        releasedAt: new Date(),
      },
    });

    return updateResult.count === 1;
  },

  /**
   * Finalizes all ACTIVE reservations tied to an order.
   */
  async finalizeAllOrderReservations(tx: TransactionClient, orderId: string): Promise<number> {
    const result = await tx.reservation.updateMany({
      where: {
        orderId,
        status: ReservationStatus.ACTIVE,
      },
      data: {
        status: ReservationStatus.FINALIZED,
        releasedAt: new Date(),
      },
    });

    return result.count;
  },

  /**
   * Shared lazy-expiration helper:
   * Checks if any ACTIVE reservation on orderId is past expiresAt.
   * If so, releases all expired active reservations, restores stock, and if order is RESERVED, transitions order to EXPIRED.
   */
  async expireOrderReservationsIfDue(tx: TransactionClient, orderId: string): Promise<boolean> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { reservations: true },
    });

    if (!order) return false;

    const now = new Date().getTime();
    const expiredReservations = order.reservations.filter(
      (res) => res.status === ReservationStatus.ACTIVE && new Date(res.expiresAt).getTime() < now
    );

    if (expiredReservations.length === 0) {
      return false;
    }

    let releasedAny = false;
    for (const res of expiredReservations) {
      const released = await this.releaseReservation(tx, res.id);
      if (released) releasedAny = true;
    }

    if (releasedAny && order.status === OrderStatus.RESERVED) {
      await transitionOrderStatus(
        tx,
        orderId,
        OrderStatus.RESERVED,
        OrderStatus.EXPIRED
      );
    }

    return releasedAny;
  },

  /**
   * Convenient helper to run expireOrderReservationsIfDue in its own transaction.
   */
  async expireOrderReservationsIfDueOutsideTx(orderId: string): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      return await this.expireOrderReservationsIfDue(tx, orderId);
    });
  },
};
