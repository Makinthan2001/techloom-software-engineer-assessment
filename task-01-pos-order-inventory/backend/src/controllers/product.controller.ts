import type { Request, Response, NextFunction } from 'express';
import { productService } from '../services/productService.js';

export const createProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductsHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const products = await productService.getAllProducts();
    res.json({
      success: true,
      data: products,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const product = await productService.getProductById(req.params['id'] as string);
    res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const updated = await productService.updateProduct(
      req.params['id'] as string,
      req.body
    );
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await productService.deleteProduct(req.params['id'] as string);
    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const getProductStockHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stockData = await productService.getProductStock(req.params['id'] as string);
    res.json({
      success: true,
      data: stockData,
    });
  } catch (err) {
    next(err);
  }
};
