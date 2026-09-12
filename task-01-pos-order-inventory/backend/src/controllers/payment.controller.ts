import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/paymentService.js';

export async function paymentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = req.params.orderId as string;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { outcome, idempotencyKey } = req.body;

    const result = await paymentService.processPayment({
      orderId,
      userId,
      role,
      outcome,
      idempotencyKey,
    });

    res.status(200).json({
      status: 'success',
      data: result.payment,
    });
  } catch (err) {
    next(err);
  }
}
