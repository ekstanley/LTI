import { Router, type Router as RouterType } from 'express';
import { config } from '../config.js';
import { getStats as getWsStats } from '../websocket/index.js';

export const healthRouter: RouterType = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    version: '0.5.0',
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

/**
 * WebSocket statistics endpoint
 */
healthRouter.get('/ws', (_req, res) => {
  const stats = getWsStats();

  res.json({
    connected: stats.connected,
    rooms: stats.rooms,
    totalSubscriptions: stats.totalSubscriptions,
    timestamp: new Date().toISOString(),
  });
});
