import { prisma } from '../config/index.js';
import { Prisma } from '@prisma/client';
import { ConflictError } from '../utils/errors.js';

export type TransactionClient = Prisma.TransactionClient;

const MAX_RETRIES = 5;

/**
 * Executes a callback within a Prisma transaction using Serializable isolation level.
 * Catches serialization failures (Postgres error 40001 / Prisma P2034) and retries
 * up to MAX_RETRIES times with a jittered exponential backoff.
 */
export async function runInStockSafeTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          return await fn(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        }
      );
    } catch (err: any) {
      attempt++;
      const isSerializationError =
        err.code === 'P2034' ||
        err.code === '40001' ||
        (err.message && err.message.includes('40001')) ||
        (err.message && err.message.includes('serialization failure')) ||
        (err.message && err.message.includes('write conflict')) ||
        (err.message && err.message.includes('deadlock'));

      if (isSerializationError && attempt < MAX_RETRIES) {
        // Jittered exponential backoff delay (e.g. 20ms - 200ms)
        const delay = Math.floor(Math.random() * 50 + 20 * Math.pow(1.5, attempt));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (isSerializationError) {
        throw new ConflictError(
          'Transaction conflicted due to concurrent modifications. Please retry your request.'
        );
      }

      throw err;
    }
  }

  throw new ConflictError('Transaction failed after maximum retry attempts');
}

export const stockService = {
  /**
   * Atomically decrements product stock ONLY if sufficient stock exists (stock >= quantity).
   * Pattern A: Conditional UPDATE enforced at the database level.
   * Runs inside the passed-in transaction context `tx`.
   * Returns `true` if 1 row was updated, or `false` if stock was insufficient.
   */
  async decrementStockIfAvailable(
    tx: TransactionClient,
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const result = await tx.product.updateMany({
      where: {
        id: productId,
        stock: {
          gte: quantity,
        },
      },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });

    return result.count === 1;
  },

  /**
   * Atomically restores product stock (stock += quantity) inside the passed-in transaction context `tx`.
   */
  async restoreStock(
    tx: TransactionClient,
    productId: string,
    quantity: number
  ): Promise<void> {
    await tx.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });
  },
};
