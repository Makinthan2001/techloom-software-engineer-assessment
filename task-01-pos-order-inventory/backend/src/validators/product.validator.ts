import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  price: z
    .number()
    .positive('Price must be greater than 0')
    .or(
      z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: 'Price must be a positive number',
      })
    ),
  stock: z.number().int('Stock must be an integer').nonnegative('Stock cannot be negative'),
});

export const productUpdateSchema = productCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
