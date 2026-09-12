import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'POS & Inventory Backend API',
    timestamp: new Date().toISOString(),
  });
});



export default router;
