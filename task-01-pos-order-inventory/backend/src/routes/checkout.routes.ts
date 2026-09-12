import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { checkoutSchema } from '../validators/index.js';
import { checkoutHandler } from '../controllers/checkout.controller.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  validate(checkoutSchema, 'body'),
  checkoutHandler
);

export default router;
