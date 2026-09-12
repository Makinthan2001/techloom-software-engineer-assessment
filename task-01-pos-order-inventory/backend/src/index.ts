import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env['PORT'] || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'POS & Inventory Backend API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to POS & Inventory API',
    healthCheck: '/api/health',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 POS Backend Server running at http://localhost:${PORT}`);
});
