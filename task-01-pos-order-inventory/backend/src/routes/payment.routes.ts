import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { paymentSchema } from '../validators/index.js';
import { paymentHandler } from '../controllers/payment.controller.js';

const router = Router();

router.post(
  '/:orderId/payment',
  requireAuth,
  validateIdParam('orderId'),
  validate(paymentSchema, 'body'),
  paymentHandler
);

export default router;
