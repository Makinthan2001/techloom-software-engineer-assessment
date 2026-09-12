import { Router } from 'express';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema, refreshSchema } from '../validators/index.js';

const router = Router();

router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, getMeHandler);

export default router;
