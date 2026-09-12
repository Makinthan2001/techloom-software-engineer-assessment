import express from 'express';
import cors from 'cors';
import { env } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();

// 1. CORS middleware (configured via CORS_ORIGIN env variable)
app.use(
  cors({
    origin: env.CORS_ORIGIN,
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
