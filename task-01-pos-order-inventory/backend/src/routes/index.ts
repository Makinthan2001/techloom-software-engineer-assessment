import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import productRouter from './product.routes.js';
import cartRouter from './cart.routes.js';
import checkoutRouter from './checkout.routes.js';
import orderRouter from './order.routes.js';

const router = Router();

router.use('/', healthRouter);
router.use('/api/auth', authRouter);
router.use('/api/products', productRouter);
router.use('/api/carts', cartRouter);
router.use('/api/checkout', checkoutRouter);
router.use('/api/orders', orderRouter);

export default router;
