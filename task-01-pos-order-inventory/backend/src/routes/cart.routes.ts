import { Router } from 'express';
import {
  createCartHandler,
  getCartByIdHandler,
  addCartItemHandler,
  updateCartItemHandler,
  removeCartItemHandler,
} from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { cartItemSchema, cartItemUpdateSchema } from '../validators/index.js';

const router = Router();

router.use(requireAuth);

router.post('/', createCartHandler);
router.get('/:id', validateIdParam('id'), getCartByIdHandler);

router.post(
  '/:id/items',
  validateIdParam('id'),
  validate(cartItemSchema),
  addCartItemHandler
);

router.patch(
  '/:id/items/:itemId',
  validateIdParam('id'),
  validateIdParam('itemId'),
  validate(cartItemUpdateSchema),
  updateCartItemHandler
);

router.delete(
  '/:id/items/:itemId',
  validateIdParam('id'),
  validateIdParam('itemId'),
  removeCartItemHandler
);

export default router;
