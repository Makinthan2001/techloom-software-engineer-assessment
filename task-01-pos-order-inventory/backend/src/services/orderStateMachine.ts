/**
 * CRITICAL ARCHITECTURAL RULE:
 * This function (transitionOrderStatus) must be the ONLY way any part of the codebase
 * ever changes Order.status — no other file should ever write order.status = X directly.
 */

import { OrderStatus, Prisma } from '@prisma/client';
import { InvalidStateTransitionError } from '../utils/errors.js';

export type TransactionClient = Prisma.TransactionClient;

/**
 * Adjacency list defining all valid OrderStatus state transitions per instruction.txt Section 11:
 *   PENDING   -> RESERVED
 *   RESERVED  -> PAID
 *   RESERVED  -> FAILED
 *   RESERVED  -> EXPIRED
 *   RESERVED  -> CANCELLED
 *   PAID      -> CANCELLED
 * 
 * All other transitions are invalid and must be rejected with 409 Conflict (InvalidStateTransitionError).
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.RESERVED],
  [OrderStatus.RESERVED]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.CANCELLED],
  [OrderStatus.FAILED]: [],
  [OrderStatus.EXPIRED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Checks if a transition from `fromState` to `toStatus` is allowed according to the state machine adjacency list.
 */
export function isTransitionAllowed(fromState: OrderStatus, toStatus: OrderStatus): boolean {
  const allowedTargets = ALLOWED_TRANSITIONS[fromState];
  return Boolean(allowedTargets && allowedTargets.includes(toStatus));
}

/**
 * Atomically transitions an Order's status inside a database transaction context `tx`.
 * 
 * Executes: UPDATE "Order" SET status = :to WHERE id = :id AND status IN (:allowedFromStates)
 * 
 * Throws InvalidStateTransitionError (HTTP 409 Conflict) if:
 * 1. The requested transition is not permitted by ALLOWED_TRANSITIONS.
 * 2. The order is not currently in one of the `allowedFromStates` (affected rows !== 1).
 * 
 * @param tx Prisma transaction client
 * @param orderId ID of the Order to transition
 * @param allowedFromStates Expected current state(s) of the order
 * @param toStatus Target state to transition to
 */
export async function transitionOrderStatus(
  tx: TransactionClient,
  orderId: string,
  allowedFromStates: OrderStatus | OrderStatus[],
  toStatus: OrderStatus
): Promise<OrderStatus> {
  const fromStates = Array.isArray(allowedFromStates) ? allowedFromStates : [allowedFromStates];

  // 1. Verify adjacency list rules for each specified source state
  for (const fromState of fromStates) {
    if (!isTransitionAllowed(fromState, toStatus)) {
      throw new InvalidStateTransitionError(
        `Invalid order state transition from ${fromState} to ${toStatus}`
      );
    }
  }

  // 2. Perform atomic conditional update in DB
  const result = await tx.order.updateMany({
    where: {
      id: orderId,
      status: {
        in: fromStates,
      },
    },
    data: {
      status: toStatus,
    },
  });

  // 3. Verify exactly 1 row was updated
  if (result.count !== 1) {
    throw new InvalidStateTransitionError(
      `Order state transition to ${toStatus} failed: order ${orderId} is not in expected state(s) [${fromStates.join(
        ', '
      )}]`
    );
  }

  return toStatus;
}
