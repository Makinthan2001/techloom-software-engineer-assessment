import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import {
  stockService,
  runInStockSafeTransaction,
} from '../../src/services/stockService.js';

describe('Concurrency-Safe Stock Primitives Tests', () => {
  let testProductId: string;

  beforeAll(async () => {
    // Clean up test product
    await prisma.product.deleteMany({
      where: { name: { startsWith: 'Concurrency Primitives Test' } },
    });
  });

  it('1. decrementStockIfAvailable succeeds and reduces stock when enough is available', async () => {
    const product = await prisma.product.create({
      data: { name: 'Concurrency Primitives Test 1', price: 10.0, stock: 10 },
    });
    testProductId = product.id;

    const result = await runInStockSafeTransaction(async (tx) => {
      return stockService.decrementStockIfAvailable(tx, testProductId, 3);
    });

    expect(result).toBe(true);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(updatedProduct?.stock).toBe(7); // 10 - 3 = 7
  });

  it('2. decrementStockIfAvailable fails (returns false) and leaves stock unchanged when insufficient', async () => {
    const result = await runInStockSafeTransaction(async (tx) => {
      return stockService.decrementStockIfAvailable(tx, testProductId, 15); // Requesting 15 from stock 7
    });

    expect(result).toBe(false);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(updatedProduct?.stock).toBe(7); // Stock unchanged
  });

  it('3. restoreStock correctly increments stock', async () => {
    await runInStockSafeTransaction(async (tx) => {
      await stockService.restoreStock(tx, testProductId, 5);
    });

    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(updatedProduct?.stock).toBe(12); // 7 + 5 = 12
  });

  it('4. CONCURRENCY PROOF: 10 concurrent decrement requests against stock = 5 results in exactly 5 successes and final stock = 0', async () => {
    // Seed product with initial stock = 5
    const concProduct = await prisma.product.create({
      data: { name: 'Concurrency Primitives Test 2', price: 20.0, stock: 5 },
    });
    const concProductId = concProduct.id;

    const TOTAL_REQUESTS = 10;
    const REQUEST_QTY = 1;

    console.log(`\n🚀 Launching ${TOTAL_REQUESTS} concurrent stock decrement requests against initial stock = 5...`);

    // Fire 10 concurrent requests simultaneously using Promise.all
    const promises = Array.from({ length: TOTAL_REQUESTS }).map(async (_, idx) => {
      try {
        const success = await runInStockSafeTransaction(async (tx) => {
          return stockService.decrementStockIfAvailable(tx, concProductId, REQUEST_QTY);
        });
        return { reqIndex: idx, success };
      } catch (err: any) {
        return { reqIndex: idx, success: false, error: err.message };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    const finalProduct = await prisma.product.findUnique({
      where: { id: concProductId },
    });

    console.log('--- CONCURRENCY TEST PROOF OUTPUT ---');
    console.log(`Requests Fired: ${TOTAL_REQUESTS}`);
    console.log(`Initial Stock:   5`);
    console.log(`Successful:      ${successCount}`);
    console.log(`Failed/Rejected: ${failureCount}`);
    console.log(`Final Stock:     ${finalProduct?.stock}`);
    console.log(`Sample Failure Reason: ${results.find((r) => !r.success)?.error}`);
    console.log('-------------------------------------\n');

    expect(TOTAL_REQUESTS).toBe(10);
    expect(successCount).toBe(5);
    expect(failureCount).toBe(5);
    expect(finalProduct?.stock).toBe(0);
  }, 30000);
});
