import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { paymentSchema } from '../validators/index.js';
import { getOrdersHandler, getOrderByIdHandler } from '../controllers/order.controller.js';
import { paymentHandler } from '../controllers/payment.controller.js';
import { cancelOrderHandler } from '../controllers/cancellation.controller.js';

const router = Router();

router.get('/', requireAuth, getOrdersHandler);
router.get('/:id', requireAuth, validateIdParam('id'), getOrderByIdHandler);
router.post(
  '/:orderId/payment',
  requireAuth,
  validateIdParam('orderId'),
  validate(paymentSchema, 'body'),
  paymentHandler
);
router.post(
  '/:orderId/cancel',
  requireAuth,
  validateIdParam('orderId'),
  cancelOrderHandler
);

export default router;
