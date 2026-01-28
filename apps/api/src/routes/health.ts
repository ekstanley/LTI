import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  // TODO: Add database and Redis connectivity checks
  const checks = {
    database: true, // Placeholder
    redis: true, // Placeholder
  };

  const isReady = Object.values(checks).every(Boolean);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});
