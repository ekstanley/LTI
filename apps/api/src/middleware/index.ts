/**
 * Middleware Index
 *
 * Re-exports all middleware modules for convenient importing.
 */

// Error handling
export { ApiError, notFoundHandler, errorHandler } from './error.js';

// Validation
export { validate } from './validate.js';

// Rate limiting
export { rateLimiter } from './rateLimiter.js';

// Authentication
export { requireAuth, optionalAuth, requireEmailVerified } from './auth.js';

// Re-export types
export type { AuthenticatedUser } from '../types/express.js';
