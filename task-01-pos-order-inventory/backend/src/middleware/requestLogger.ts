import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    // Log ONLY HTTP method, URL path, response status code, and latency
    // NEVER log request bodies (which could contain passwords/tokens) or Authorization headers
    console.log(`[HTTP] ${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${latencyMs}ms)`);
  });

  next();
}
