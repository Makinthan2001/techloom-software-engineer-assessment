import { z } from 'zod';

export const PaymentOutcomeEnum = z.enum(['SUCCESS', 'FAILURE', 'TIMEOUT']);

export const paymentSchema = z.object({
  outcome: PaymentOutcomeEnum,
  idempotencyKey: z.string().trim().min(1, 'Idempotency key cannot be empty'),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
