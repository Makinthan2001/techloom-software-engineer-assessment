import express from 'express';
import cors from 'cors';
import { env } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();

// 1. CORS middleware (configured via CORS_ORIGIN env variable with local dev fallback)
const getAllowedOrigins = (): string[] => {
  const envOrigin = process.env.CORS_ORIGIN || env.CORS_ORIGIN || '';
  const parsedOrigins = envOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const localDefaults = ['http://localhost:3000', 'http://localhost:5173'];
  return Array.from(new Set([...parsedOrigins, ...localDefaults]));
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = getAllowedOrigins();
      const normalizedOrigin = origin.replace(/\/$/, '');

      if (allowed.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

// 2. Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Request logging middleware (logs method, URL path, status, latency)
app.use(requestLogger);

// 4. Application routes
app.use('/', routes);

// 5. Centralized error-handling middleware (registered LAST)
app.use(errorHandler);

export default app;
