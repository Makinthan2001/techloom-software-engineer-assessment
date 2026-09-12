import { z } from 'zod';

export const checkoutSchema = z.object({
  cartId: z.string().uuid('Invalid Cart ID format (UUID required)'),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key cannot be empty'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
