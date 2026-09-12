import { Router } from 'express';
import {
  createProductHandler,
  getProductsHandler,
  getProductByIdHandler,
  updateProductHandler,
  deleteProductHandler,
  getProductStockHandler,
} from '../controllers/product.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { productCreateSchema, productUpdateSchema } from '../validators/index.js';

const router = Router();

// Every route requires authentication
router.use(requireAuth);

// Read routes (ADMIN + CASHIER)
router.get('/', getProductsHandler);
router.get('/:id', validateIdParam('id'), getProductByIdHandler);
router.get('/:id/stock', validateIdParam('id'), getProductStockHandler);

// Write routes (ADMIN only)
router.post('/', requireRole('ADMIN'), validate(productCreateSchema), createProductHandler);
router.patch(
  '/:id',
  requireRole('ADMIN'),
  validateIdParam('id'),
  validate(productUpdateSchema),
  updateProductHandler
);
router.delete('/:id', requireRole('ADMIN'), validateIdParam('id'), deleteProductHandler);

export default router;
