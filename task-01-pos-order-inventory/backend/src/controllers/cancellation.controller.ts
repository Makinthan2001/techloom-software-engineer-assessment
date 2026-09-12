import type { Request, Response, NextFunction } from 'express';
import { cancellationService } from '../services/cancellationService.js';

export async function cancelOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = req.params.orderId as string;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const result = await cancellationService.cancelOrder(orderId, userId, role);

    res.status(200).json({
      status: 'success',
      data: result.order,
    });
  } catch (err) {
    next(err);
  }
}
