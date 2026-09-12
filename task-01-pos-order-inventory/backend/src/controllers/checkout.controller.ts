import type { Request, Response, NextFunction } from 'express';
import { checkoutService } from '../services/checkoutService.js';

export async function checkoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { cartId, idempotencyKey } = req.body;

    const result = await checkoutService.processCheckout(userId, cartId, idempotencyKey);

    res.status(200).json({
      status: 'success',
      data: result.order,
    });
  } catch (err) {
    next(err);
  }
}
