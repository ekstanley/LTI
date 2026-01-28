import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createServer } from 'http';

import { config } from './config.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { healthRouter } from './routes/health.js';
import { billsRouter } from './routes/bills.js';
import { legislatorsRouter } from './routes/legislators.js';
import { votesRouter } from './routes/votes.js';
import { analysisRouter } from './routes/analysis.js';
import { conflictsRouter } from './routes/conflicts.js';
import { committeesRouter } from './routes/committees.js';
import { setupWebSocket } from './websocket/index.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  })
);

// Rate limiting
app.use(rateLimiter);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/v1/bills', billsRouter);
app.use('/api/v1/legislators', legislatorsRouter);
app.use('/api/v1/votes', votesRouter);
app.use('/api/v1/analysis', analysisRouter);
app.use('/api/v1/conflicts', conflictsRouter);
app.use('/api/v1/committees', committeesRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server for WebSocket support
const server = createServer(app);

// Setup WebSocket server
setupWebSocket(server);

// Start server
server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
