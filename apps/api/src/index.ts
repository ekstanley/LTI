import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
import { authRouter } from './routes/auth.js';
import { setupWebSocket } from './websocket/index.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware with production hardening
app.use(
  helmet({
    // Strict Transport Security - enforce HTTPS
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Content Security Policy - restrictive for API
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Prevent MIME type sniffing
    noSniff: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Cross-origin policies
    crossOriginEmbedderPolicy: false, // Disabled for API compatibility
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
app.use('/api/v1/voting-record', votesRouter); // Alias for votes (common alternative naming)
app.use('/api/v1/analysis', analysisRouter);
app.use('/api/v1/conflicts', conflictsRouter);
app.use('/api/v1/committees', committeesRouter);
app.use('/api/v1/auth', authRouter);

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
