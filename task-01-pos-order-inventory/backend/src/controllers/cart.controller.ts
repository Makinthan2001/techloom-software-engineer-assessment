import type { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cartService.js';

export const createCartHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await cartService.createCart(req.user!.userId);
    res.status(201).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

export const getCartByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await cartService.getCartById(
      req.params['id'] as string,
      req.user!.userId
    );
    res.json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

export const addCartItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await cartService.addItemToCart(
      req.params['id'] as string,
      req.user!.userId,
      req.body
    );
    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCartItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await cartService.updateCartItem(
      req.params['id'] as string,
      req.params['itemId'] as string,
      req.user!.userId,
      req.body.quantity
    );
    res.json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
};

export const removeCartItemHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cartService.removeCartItem(
      req.params['id'] as string,
      req.params['itemId'] as string,
      req.user!.userId
    );
    res.json({
      success: true,
      message: 'Cart item removed successfully',
    });
  } catch (err) {
    next(err);
  }
};
