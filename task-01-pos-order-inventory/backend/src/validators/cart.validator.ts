import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().uuid('Invalid Product ID format (UUID required)'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be at least 1'),
});

export const cartItemUpdateSchema = z.object({
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be at least 1'),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
