import type { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/orderService.js';

export async function getOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    const orders = await orderService.getOrders(userId, role);

    res.status(200).json({
      status: 'success',
      data: orders,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = req.params.id as string;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const order = await orderService.getOrderById(orderId, userId, role);

    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (err) {
    next(err);
  }
}
