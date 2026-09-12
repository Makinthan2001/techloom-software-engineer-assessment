import { prisma } from '../config/index.js';
import { OrderStatus } from '@prisma/client';
import { reservationService } from '../services/reservationService.js';
import { transitionOrderStatus } from '../services/orderStateMachine.js';

let sweeperIntervalTimer: NodeJS.Timeout | null = null;

/**
 * Sweeps all ACTIVE reservations past their expiresAt date, releasing stock and transitioning parent orders to EXPIRED.
 */
export async function sweepExpiredReservations(): Promise<number> {
  const now = new Date();

  // 1. Find all ACTIVE reservations where expiresAt < now
  const expiredActiveReservations = await prisma.reservation.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        lt: now,
      },
    },
    include: {
      order: true,
    },
  });

  let expiredCount = 0;

  // 2. Process each expired reservation in its own transaction
  for (const res of expiredActiveReservations) {
    try {
      await prisma.$transaction(async (tx) => {
        // Attempt atomic release of the reservation (ACTIVE -> RELEASED + stock += quantity)
        const released = await reservationService.releaseReservation(tx, res.id);

        if (released) {
          expiredCount++;

          // Check parent order status; if still RESERVED, transition to EXPIRED
          const currentOrder = await tx.order.findUnique({
            where: { id: res.orderId },
          });

          if (currentOrder && currentOrder.status === OrderStatus.RESERVED) {
            await transitionOrderStatus(
              tx,
              res.orderId,
              OrderStatus.RESERVED,
              OrderStatus.EXPIRED
            );
          }
        }
      });
    } catch (err: any) {
      console.error(`Error in sweeper processing reservation ${res.id}:`, err.message);
    }
  }

  return expiredCount;
}

/**
 * Starts the background sweeper interval.
 * @param intervalMs Sweep interval in milliseconds (default 30000ms / 30 seconds)
 */
export function startReservationExpirySweeper(intervalMs = 30000) {
  if (sweeperIntervalTimer) {
    clearInterval(sweeperIntervalTimer);
  }

  console.log(`[Sweeper] Starting reservation expiry sweeper (interval: ${intervalMs}ms)...`);
  sweeperIntervalTimer = setInterval(async () => {
    try {
      const swept = await sweepExpiredReservations();
      if (swept > 0) {
        console.log(`[Sweeper] Expired ${swept} reservation(s) and restored stock.`);
      }
    } catch (err: any) {
      console.error('[Sweeper] Unexpected error in sweeper cycle:', err.message);
    }
  }, intervalMs);
}

/**
 * Stops the background sweeper timer.
 */
export function stopReservationExpirySweeper() {
  if (sweeperIntervalTimer) {
    clearInterval(sweeperIntervalTimer);
    sweeperIntervalTimer = null;
    console.log('[Sweeper] Stopped reservation expiry sweeper.');
  }
}
