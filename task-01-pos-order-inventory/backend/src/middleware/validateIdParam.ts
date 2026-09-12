import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const validateIdParam = (paramName = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    const result = uuidSchema.safeParse(value);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format for parameter '${paramName}'. Must be a valid UUID.`,
      });
    }
    next();
  };
};
