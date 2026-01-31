# Authentication System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement production-grade JWT authentication with OAuth2 support for the LTIP API, fixing SEC-001 and SEC-002 security gaps.

**Architecture:** Stateless JWT authentication with short-lived access tokens (15min) and HTTP-only refresh tokens (7d). OAuth2 providers (Google, GitHub) for social login. Argon2id for password hashing. All auth state stored in PostgreSQL via existing User model.

**Tech Stack:** Express.js, jsonwebtoken, argon2, passport, passport-google-oauth20, passport-github2, Prisma ORM, Zod validation

---

## Risk Assessment (ODIN Methodology)

| Risk | Severity | Mitigation |
|------|----------|------------|
| JWT secret exposure | CRITICAL | Environment variable, never in code |
| Token replay attacks | HIGH | Short expiry + refresh rotation |
| Password storage breach | HIGH | Argon2id with strong params |
| XSS token theft | HIGH | HTTP-only cookies for refresh |
| CSRF attacks | MEDIUM | SameSite cookies + CSRF tokens |
| OAuth state hijacking | MEDIUM | Cryptographic state parameter |

## Dependencies

| Component | Depends On | Notes |
|-----------|------------|-------|
| Task 2 (Config) | Task 1 (Dependencies) | Need packages first |
| Task 3 (Schema) | Task 2 (Config) | Need env vars for migration |
| Task 4 (JWT Service) | Task 1-3 | Core auth logic |
| Task 5 (Password Service) | Task 1 | Password hashing |
| Task 6 (Auth Middleware) | Task 4 | Middleware uses JWT service |
| Task 7 (Auth Routes) | Task 4-6 | Routes use all services |
| Task 8 (WebSocket Auth) | Task 4 | SEC-002 depends on JWT service |
| Task 9-10 (OAuth) | Task 7 | OAuth builds on basic auth |

## Effort Estimates

| Task | Effort | Priority |
|------|--------|----------|
| Task 1: Dependencies | 15min | P0 |
| Task 2: Config | 20min | P0 |
| Task 3: Schema Migration | 30min | P0 |
| Task 4: JWT Service | 45min | P0 |
| Task 5: Password Service | 30min | P0 |
| Task 6: Auth Middleware | 45min | P0 |
| Task 7: Auth Routes | 60min | P0 |
| Task 8: WebSocket JWT (SEC-002) | 45min | P0 |
| Task 9: OAuth Google | 45min | P1 |
| Task 10: OAuth GitHub | 30min | P1 |
| **Total** | **~6h** | |

---

## Task 1: Add Authentication Dependencies

**Files:**
- Modify: `apps/api/package.json`

**Acceptance Criteria:**
- [ ] All packages installed successfully
- [ ] TypeScript types available
- [ ] No version conflicts

**Step 1: Add production dependencies**

```bash
cd /Users/estanley/Documents/GitHub/LTI
pnpm --filter @ltip/api add jsonwebtoken argon2 passport passport-jwt passport-google-oauth20 passport-github2 cookie-parser
```

**Step 2: Add dev dependencies for types**

```bash
pnpm --filter @ltip/api add -D @types/jsonwebtoken @types/passport @types/passport-jwt @types/passport-google-oauth20 @types/passport-github2 @types/cookie-parser
```

**Step 3: Verify installation**

```bash
pnpm --filter @ltip/api exec tsc --noEmit
```
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add authentication dependencies"
```

---

## Task 2: Add Authentication Configuration

**Files:**
- Modify: `apps/api/src/config.ts`
- Create: `.env.example` (update)

**Acceptance Criteria:**
- [ ] JWT_SECRET required in production
- [ ] OAuth credentials optional but validated if present
- [ ] Token expiry times configurable

**Step 1: Write the config test**

```typescript
// apps/api/src/__tests__/config.test.ts (add to existing)
describe('auth config', () => {
  it('requires JWT_SECRET in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => {
      // Re-import to trigger validation
      jest.resetModules();
      require('../config');
    }).toThrow();

    process.env.NODE_ENV = originalEnv;
  });
});
```

**Step 2: Update config schema**

Add to `apps/api/src/config.ts` after line 24:

```typescript
  // Authentication
  JWT_SECRET: z.string().min(32).optional().refine(
    (val) => process.env.NODE_ENV !== 'production' || val !== undefined,
    { message: 'JWT_SECRET is required in production' }
  ),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_URL: z.string().default('http://localhost:4000/api/v1/auth'),
```

**Step 3: Export auth config**

Add to config export object:

```typescript
  auth: {
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars',
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  },
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    callbackUrl: env.OAUTH_CALLBACK_URL,
  },
```

**Step 4: Run tests**

```bash
pnpm --filter @ltip/api test
```
Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/api/src/config.ts
git commit -m "feat(api): add authentication config schema"
```

---

## Task 3: Extend User Schema for Auth

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Acceptance Criteria:**
- [ ] User model has OAuth provider fields
- [ ] RefreshToken model exists
- [ ] Migration runs successfully
- [ ] Existing data preserved

**Step 1: Add OAuth fields to User model**

Modify User model (around line 591):

```prisma
/// Application user
model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String? // Null for OAuth-only users

  // Profile
  name         String?
  avatarUrl    String?

  // Email verification
  emailVerified    Boolean   @default(false)
  emailVerifiedAt  DateTime?

  // OAuth providers
  googleId     String?  @unique
  githubId     String?  @unique

  // Rate limiting
  rateLimit Int @default(100) // Requests per minute

  // Relations
  subscriptions  Subscription[]
  apiKeys        ApiKey[]
  refreshTokens  RefreshToken[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([googleId])
  @@index([githubId])
  @@map("users")
}

/// Refresh token for JWT rotation
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique // Hashed token
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?

  // Device tracking (optional)
  userAgent String?
  ipAddress String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("refresh_tokens")
}
```

**Step 2: Generate migration**

```bash
cd /Users/estanley/Documents/GitHub/LTI/apps/api
pnpm prisma migrate dev --name add_auth_fields
```
Expected: Migration successful

**Step 3: Generate Prisma client**

```bash
pnpm prisma generate
```

**Step 4: Verify types**

```bash
pnpm --filter @ltip/api exec tsc --noEmit
```
Expected: No errors

**Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): add OAuth and refresh token schema"
```

---

## Task 4: Create JWT Service

**Files:**
- Create: `apps/api/src/services/jwt.service.ts`
- Create: `apps/api/src/__tests__/services/jwt.service.test.ts`

**Acceptance Criteria:**
- [ ] Generate valid access tokens with user claims
- [ ] Generate refresh tokens with rotation
- [ ] Verify tokens and return decoded payload
- [ ] Reject expired/invalid tokens
- [ ] 100% test coverage on service

**Step 1: Write failing tests**

Create `apps/api/src/__tests__/services/jwt.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { jwtService } from '../../services/jwt.service.js';

// Mock config
vi.mock('../../config.js', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret-must-be-at-least-32-characters-long',
      accessExpiry: '15m',
      refreshExpiry: '7d',
    },
  },
}));

describe('JWT Service', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  describe('generateAccessToken', () => {
    it('generates a valid JWT with user claims', () => {
      const token = jwtService.generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure
    });

    it('includes correct claims in payload', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const decoded = jwtService.verifyAccessToken(token);

      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a cryptographically secure token', () => {
      const token = jwtService.generateRefreshToken();

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThanOrEqual(64);
    });

    it('generates unique tokens', () => {
      const token1 = jwtService.generateRefreshToken();
      const token2 = jwtService.generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies valid token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const decoded = jwtService.verifyAccessToken(token);

      expect(decoded.sub).toBe(mockUser.id);
    });

    it('throws on invalid token', () => {
      expect(() => jwtService.verifyAccessToken('invalid-token'))
        .toThrow('Invalid token');
    });

    it('throws on expired token', async () => {
      // Generate token with 1ms expiry (effectively expired)
      const token = jwtService.generateAccessToken(mockUser, '1ms');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(() => jwtService.verifyAccessToken(token))
        .toThrow('Token expired');
    });
  });

  describe('hashRefreshToken', () => {
    it('produces consistent hash for same input', () => {
      const token = 'test-refresh-token';
      const hash1 = jwtService.hashRefreshToken(token);
      const hash2 = jwtService.hashRefreshToken(token);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different input', () => {
      const hash1 = jwtService.hashRefreshToken('token1');
      const hash2 = jwtService.hashRefreshToken('token2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @ltip/api test jwt.service
```
Expected: FAIL (module not found)

**Step 3: Implement JWT service**

Create `apps/api/src/services/jwt.service.ts`:

```typescript
/**
 * JWT Service
 *
 * Handles JWT generation, verification, and refresh token management.
 * Uses HS256 for signing (symmetric, suitable for single-service auth).
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface UserForToken {
  id: string;
  email: string;
}

/**
 * JWT Service singleton
 */
export const jwtService = {
  /**
   * Generate an access token for a user
   */
  generateAccessToken(user: UserForToken, expiresIn?: string): string {
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'access' as const,
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: expiresIn ?? config.auth.accessExpiry,
      algorithm: 'HS256',
    });
  },

  /**
   * Verify an access token and return decoded payload
   * @throws Error if token is invalid or expired
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  },

  /**
   * Generate a cryptographically secure refresh token
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex');
  },

  /**
   * Hash a refresh token for storage
   * Uses SHA-256 for fast comparison during token lookup
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  /**
   * Calculate expiry date for refresh token
   */
  getRefreshTokenExpiry(): Date {
    const match = config.auth.refreshExpiry.match(/^(\d+)([dhms])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + parseInt(value) * multipliers[unit]);
  },
};

export type JwtService = typeof jwtService;
```

**Step 4: Run tests to verify they pass**

```bash
pnpm --filter @ltip/api test jwt.service
```
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/jwt.service.ts apps/api/src/__tests__/services/
git commit -m "feat(api): add JWT service with token generation and verification"
```

---

## Task 5: Create Password Service

**Files:**
- Create: `apps/api/src/services/password.service.ts`
- Create: `apps/api/src/__tests__/services/password.service.test.ts`

**Acceptance Criteria:**
- [ ] Hash passwords with Argon2id
- [ ] Verify passwords against hashes
- [ ] Use secure parameters (memory: 64MB, iterations: 3, parallelism: 4)
- [ ] 100% test coverage

**Step 1: Write failing tests**

Create `apps/api/src/__tests__/services/password.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { passwordService } from '../../services/password.service.js';

describe('Password Service', () => {
  const testPassword = 'SecurePassword123!';

  describe('hash', () => {
    it('produces a hash different from input', async () => {
      const hash = await passwordService.hash(testPassword);

      expect(hash).not.toBe(testPassword);
      expect(hash.startsWith('$argon2')).toBe(true);
    });

    it('produces different hashes for same password (salted)', async () => {
      const hash1 = await passwordService.hash(testPassword);
      const hash2 = await passwordService.hash(testPassword);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('returns true for correct password', async () => {
      const hash = await passwordService.hash(testPassword);
      const isValid = await passwordService.verify(testPassword, hash);

      expect(isValid).toBe(true);
    });

    it('returns false for incorrect password', async () => {
      const hash = await passwordService.hash(testPassword);
      const isValid = await passwordService.verify('WrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('returns false for empty password', async () => {
      const hash = await passwordService.hash(testPassword);
      const isValid = await passwordService.verify('', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('validateStrength', () => {
    it('accepts strong passwords', () => {
      const result = passwordService.validateStrength('SecureP@ss123');
      expect(result.valid).toBe(true);
    });

    it('rejects short passwords', () => {
      const result = passwordService.validateStrength('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('rejects passwords without numbers', () => {
      const result = passwordService.validateStrength('NoNumbers!!');
      expect(result.valid).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @ltip/api test password.service
```
Expected: FAIL

**Step 3: Implement password service**

Create `apps/api/src/services/password.service.ts`:

```typescript
/**
 * Password Service
 *
 * Handles password hashing and verification using Argon2id.
 * Argon2id is the OWASP-recommended algorithm for password storage.
 */

import * as argon2 from 'argon2';

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
  score: number; // 0-4
}

/**
 * Argon2id configuration
 * Based on OWASP recommendations for 2024
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 parallel threads
};

/**
 * Password Service singleton
 */
export const passwordService = {
  /**
   * Hash a password using Argon2id
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  },

  /**
   * Verify a password against its hash
   */
  async verify(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  },

  /**
   * Validate password strength
   */
  validateStrength(password: string): PasswordStrengthResult {
    const errors: string[] = [];
    let score = 0;

    // Minimum length
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    } else {
      score++;
    }

    // Contains number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score++;
    }

    // Contains lowercase
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score++;
    }

    // Contains uppercase
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score++;
    }

    return {
      valid: errors.length === 0,
      errors,
      score,
    };
  },
};

export type PasswordService = typeof passwordService;
```

**Step 4: Run tests**

```bash
pnpm --filter @ltip/api test password.service
```
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/services/password.service.ts apps/api/src/__tests__/services/
git commit -m "feat(api): add password service with Argon2id hashing"
```

---

## Task 6: Create Authentication Middleware

**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/__tests__/middleware/auth.test.ts`

**Acceptance Criteria:**
- [ ] Extract JWT from Authorization header (Bearer scheme)
- [ ] Verify token and attach user to request
- [ ] Return 401 for missing/invalid tokens
- [ ] Optional middleware variant for public routes
- [ ] 100% test coverage

**Step 1: Write failing tests**

Create `apps/api/src/__tests__/middleware/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { jwtService } from '../../services/jwt.service.js';

// Mock dependencies
vi.mock('../../services/jwt.service.js');
vi.mock('../../lib/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('returns 401 when no Authorization header', async () => {
      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'MISSING_TOKEN',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 for invalid Bearer format', async () => {
      mockReq.headers = { authorization: 'InvalidFormat token123' };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid authorization format',
        code: 'INVALID_FORMAT',
      });
    });

    it('returns 401 for invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('attaches user to request for valid token', async () => {
      const mockPayload = { sub: 'user-123', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('calls next without user when no token', async () => {
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toBeUndefined();
    });

    it('attaches user for valid token', async () => {
      const mockPayload = { sub: 'user-123', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('calls next without user for invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toBeUndefined();
    });
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm --filter @ltip/api test auth.test
```
Expected: FAIL

**Step 3: Implement auth middleware**

Create `apps/api/src/middleware/auth.ts`:

```typescript
/**
 * Authentication Middleware
 *
 * JWT-based authentication for Express routes.
 * Extracts Bearer token from Authorization header and verifies it.
 */

import type { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwt.service.js';
import { logger } from '../lib/logger.js';

/**
 * Extend Express Request with user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Middleware that requires authentication.
 * Returns 401 if token is missing or invalid.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  const token = extractToken(authHeader);
  if (!token) {
    res.status(401).json({
      error: 'Invalid authorization format',
      code: 'INVALID_FORMAT',
    });
    return;
  }

  try {
    const payload = jwtService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    logger.debug({ userId: payload.sub }, 'User authenticated');
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    logger.warn({ error: message }, 'Authentication failed');

    res.status(401).json({
      error: message,
      code: message === 'Token expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}

/**
 * Middleware that optionally authenticates.
 * Attaches user if valid token provided, but doesn't require it.
 * Always calls next() - useful for routes that behave differently for auth/anon users.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);

  if (token) {
    try {
      const payload = jwtService.verifyAccessToken(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
      };
      logger.debug({ userId: payload.sub }, 'User authenticated (optional)');
    } catch {
      // Token invalid - continue as anonymous
      logger.debug('Invalid token in optional auth, continuing as anonymous');
    }
  }

  next();
}
```

**Step 4: Run tests**

```bash
pnpm --filter @ltip/api test auth.test
```
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/__tests__/middleware/
git commit -m "feat(api): add authentication middleware with JWT verification"
```

---

## Task 7: Create Auth Routes

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/__tests__/routes/auth.test.ts`
- Modify: `apps/api/src/index.ts`

**Acceptance Criteria:**
- [ ] POST /auth/register - Create new user with email/password
- [ ] POST /auth/login - Authenticate and return tokens
- [ ] POST /auth/refresh - Exchange refresh token for new access token
- [ ] POST /auth/logout - Revoke refresh token
- [ ] GET /auth/me - Return current user info
- [ ] Input validation with Zod
- [ ] Proper error responses
- [ ] Integration tests passing

**Step 1: Write integration tests**

Create `apps/api/src/__tests__/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from '../../routes/auth.js';
import { prisma } from '../../lib/prisma.js';

// Setup test app
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(async () => {
    // Clean up test users
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /auth/register', () => {
    it('creates a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('newuser@test.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('returns 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'user@test.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('returns 409 for duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'SecurePass123!',
        });

      // Try duplicate
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'AnotherPass456!',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login@test.com',
          password: 'SecurePass123!',
        });
    });

    it('authenticates with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'SecurePass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('returns 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePass123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@test.com',
          password: 'SecurePass123!',
        });
      refreshToken = response.body.refreshToken;
    });

    it('returns new tokens for valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      // Old refresh token should be different (rotation)
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('returns 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'me@test.com',
          password: 'SecurePass123!',
        });
      accessToken = response.body.accessToken;
    });

    it('returns user info for authenticated request', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('me@test.com');
    });

    it('returns 401 without token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
```

**Step 2: Run tests to verify failure**

```bash
pnpm --filter @ltip/api test auth.test
```
Expected: FAIL

**Step 3: Implement auth routes**

Create `apps/api/src/routes/auth.ts`:

```typescript
/**
 * Authentication Routes
 *
 * Handles user registration, login, token refresh, and logout.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { jwtService } from '../services/jwt.service.js';
import { passwordService } from '../services/password.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

export const authRouter = Router();

// ============================================================================
// Schemas
// ============================================================================

const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
});

// ============================================================================
// Helpers
// ============================================================================

async function createTokens(userId: string, email: string, req: any) {
  // Generate tokens
  const accessToken = jwtService.generateAccessToken({ id: userId, email });
  const refreshToken = jwtService.generateRefreshToken();
  const hashedRefresh = jwtService.hashRefreshToken(refreshToken);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedRefresh,
      expiresAt: jwtService.getRefreshTokenExpiry(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    },
  });

  return { accessToken, refreshToken };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /auth/register
 * Create a new user account
 */
authRouter.post('/register', validateRequest(registerSchema), async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Validate password strength
    const strengthResult = passwordService.validateStrength(password);
    if (!strengthResult.valid) {
      res.status(400).json({
        error: 'Password too weak',
        details: strengthResult.errors,
      });
      return;
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password and create user
    const passwordHash = await passwordService.hash(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const tokens = await createTokens(user.id, user.email, req);

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    res.status(201).json({
      ...tokens,
      user,
    });
  } catch (error) {
    logger.error({ error }, 'Registration failed');
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/login
 * Authenticate with email and password
 */
authRouter.post('/login', validateRequest(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });

    // Use constant-time comparison to prevent timing attacks
    if (!user || !user.passwordHash) {
      // Hash anyway to prevent timing attacks revealing user existence
      await passwordService.hash('dummy-password');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await passwordService.verify(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const tokens = await createTokens(user.id, user.email, req);

    logger.info({ userId: user.id }, 'User logged in');

    res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Login failed');
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /auth/refresh
 * Exchange refresh token for new access token
 */
authRouter.post('/refresh', validateRequest(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const hashedToken = jwtService.hashRefreshToken(refreshToken);

    // Find and validate refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await createTokens(storedToken.user.id, storedToken.user.email, req);

    res.json(tokens);
  } catch (error) {
    logger.error({ error }, 'Token refresh failed');
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /auth/logout
 * Revoke the refresh token
 */
authRouter.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const hashedToken = jwtService.hashRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { token: hashedToken },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Ignore errors - logout should always succeed
    }
  }

  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current user info
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    logger.error({ error }, 'Failed to get user');
    res.status(500).json({ error: 'Failed to get user info' });
  }
});
```

**Step 4: Register routes in index.ts**

Add to `apps/api/src/index.ts` after other imports:

```typescript
import { authRouter } from './routes/auth.js';
```

Add route after other routes (around line 85):

```typescript
app.use('/api/v1/auth', authRouter);
```

**Step 5: Run tests**

```bash
pnpm --filter @ltip/api test
```
Expected: All tests PASS

**Step 6: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/index.ts apps/api/src/__tests__/routes/
git commit -m "feat(api): add authentication routes (register, login, refresh, logout)"
```

---

## Task 8: Fix WebSocket JWT Verification (SEC-002)

**Files:**
- Modify: `apps/api/src/websocket/auth.ts`
- Modify: `apps/api/src/__tests__/websocket/auth.test.ts`

**Acceptance Criteria:**
- [ ] Replace format-only validation with actual JWT verification
- [ ] Use jwtService.verifyAccessToken()
- [ ] Maintain anonymous connection support
- [ ] All existing tests still pass
- [ ] New tests for JWT verification

**Step 1: Update auth tests for actual verification**

Update `apps/api/src/__tests__/websocket/auth.test.ts`:

```typescript
/**
 * WebSocket Authentication Tests
 *
 * Tests for JWT token verification in WebSocket upgrade requests.
 * NOW INCLUDES ACTUAL SIGNATURE VERIFICATION (SEC-002 fix).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage } from 'http';
import { authenticateWebSocketRequest, requiresAuthentication } from '../../websocket/auth.js';
import { jwtService } from '../../services/jwt.service.js';

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Mock jwtService
vi.mock('../../services/jwt.service.js');

// Helper to create mock HTTP request
function createMockRequest(options: {
  url?: string;
  host?: string;
  protocol?: string;
}): IncomingMessage {
  return {
    url: options.url ?? '/',
    headers: {
      host: options.host ?? 'localhost:4001',
      ...(options.protocol && { 'sec-websocket-protocol': options.protocol }),
    },
  } as IncomingMessage;
}

describe('WebSocket Authentication (SEC-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateWebSocketRequest', () => {
    describe('anonymous connections', () => {
      it('allows connection without token', () => {
        const req = createMockRequest({ url: '/ws' });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(true);
        expect(result.userId).toBeUndefined();
      });
    });

    describe('JWT verification', () => {
      it('verifies token signature using jwtService', () => {
        const mockPayload = { sub: 'user-123', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
        vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

        const req = createMockRequest({ url: '/ws?token=valid.jwt.token' });
        const result = authenticateWebSocketRequest(req);

        expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt.token');
        expect(result.authenticated).toBe(true);
        expect(result.userId).toBe('user-123');
      });

      it('rejects invalid JWT signature', () => {
        vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const req = createMockRequest({ url: '/ws?token=invalid.jwt.token' });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid token');
      });

      it('rejects expired token', () => {
        vi.mocked(jwtService.verifyAccessToken).mockImplementation(() => {
          throw new Error('Token expired');
        });

        const req = createMockRequest({ url: '/ws?token=expired.jwt.token' });
        const result = authenticateWebSocketRequest(req);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Token expired');
      });
    });

    describe('token extraction', () => {
      it('extracts token from query string', () => {
        const mockPayload = { sub: 'user-456', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
        vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

        const req = createMockRequest({ url: '/ws?token=query.string.token' });
        authenticateWebSocketRequest(req);

        expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('query.string.token');
      });

      it('extracts token from Sec-WebSocket-Protocol header', () => {
        const mockPayload = { sub: 'user-789', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
        vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

        const req = createMockRequest({
          url: '/ws',
          protocol: 'token.header.protocol.token',
        });
        authenticateWebSocketRequest(req);

        expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('header.protocol.token');
      });

      it('prioritizes query string over protocol header', () => {
        const mockPayload = { sub: 'query-user', email: 'test@example.com', type: 'access' as const, iat: 0, exp: 0 };
        vi.mocked(jwtService.verifyAccessToken).mockReturnValue(mockPayload);

        const req = createMockRequest({
          url: '/ws?token=query.token.here',
          protocol: 'token.header.token.here',
        });
        authenticateWebSocketRequest(req);

        expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('query.token.here');
      });
    });
  });

  describe('requiresAuthentication', () => {
    it('returns false for public rooms', () => {
      expect(requiresAuthentication('bill:hr-1234')).toBe(false);
      expect(requiresAuthentication('vote:abc123')).toBe(false);
    });

    // Phase 2: Add tests for authenticated rooms when implemented
  });
});
```

**Step 2: Run tests to see current state**

```bash
pnpm --filter @ltip/api test websocket/auth
```

**Step 3: Update WebSocket auth to use actual JWT verification**

Replace `apps/api/src/websocket/auth.ts`:

```typescript
/**
 * WebSocket Authentication
 *
 * SEC-002 FIX: Now performs actual JWT signature verification.
 *
 * Token can be provided via:
 * - Query string: ws://host/ws?token=xxx
 * - Sec-WebSocket-Protocol header: token.xxx
 */

import type { IncomingMessage } from 'http';
import { logger } from '../lib/logger.js';
import { jwtService } from '../services/jwt.service.js';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Authenticate WebSocket upgrade request
 *
 * SECURITY: This now performs actual JWT signature verification.
 */
export function authenticateWebSocketRequest(req: IncomingMessage): AuthResult {
  const token = extractToken(req);

  // No token = anonymous connection (allowed for public data)
  if (!token) {
    logger.debug('WebSocket connection without token (anonymous)');
    return { authenticated: true };
  }

  try {
    // Verify JWT signature and expiration
    const payload = jwtService.verifyAccessToken(token);

    logger.debug({ userId: payload.sub }, 'WebSocket authenticated');
    return {
      authenticated: true,
      userId: payload.sub,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    logger.warn({ error: message }, 'WebSocket authentication failed');

    return {
      authenticated: false,
      error: message,
    };
  }
}

/**
 * Extract token from request
 * Priority: 1) Query string, 2) Sec-WebSocket-Protocol
 */
function extractToken(req: IncomingMessage): string | null {
  // Try query string first
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // Try Sec-WebSocket-Protocol header (custom subprotocol pattern)
  const protocols = req.headers['sec-websocket-protocol'];
  if (protocols) {
    const protocolList = protocols.split(',').map((p) => p.trim());
    const tokenProtocol = protocolList.find((p) => p.startsWith('token.'));
    if (tokenProtocol) {
      return tokenProtocol.slice(6); // Remove 'token.' prefix
    }
  }

  return null;
}

/**
 * Check if a room requires authentication
 * Phase 2: Configure room-based auth requirements
 */
export function requiresAuthentication(_room: string): boolean {
  // Currently all rooms are public
  // Phase 2: Implement room-based auth requirements
  // Example: return room.startsWith('user:') || room.startsWith('private:');
  return false;
}
```

**Step 4: Run tests**

```bash
pnpm --filter @ltip/api test websocket/auth
```
Expected: All tests PASS

**Step 5: Run full test suite**

```bash
pnpm --filter @ltip/api test
```
Expected: All tests PASS

**Step 6: Commit**

```bash
git add apps/api/src/websocket/auth.ts apps/api/src/__tests__/websocket/
git commit -m "fix(api): implement JWT signature verification in WebSocket auth (SEC-002)"
```

---

## Task 9: Add OAuth Google Provider (P1)

**Files:**
- Create: `apps/api/src/auth/strategies/google.ts`
- Modify: `apps/api/src/routes/auth.ts`

**Acceptance Criteria:**
- [ ] OAuth flow initiates correctly
- [ ] Callback creates/updates user
- [ ] Links Google account to existing email
- [ ] Returns JWT tokens on success

**Step 1: Create Google strategy**

Create `apps/api/src/auth/strategies/google.ts`:

```typescript
/**
 * Google OAuth Strategy
 */

import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export function createGoogleStrategy() {
  if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
    logger.warn('Google OAuth not configured - skipping strategy');
    return null;
  }

  return new GoogleStrategy(
    {
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: `${config.oauth.callbackUrl}/google/callback`,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email from Google'));
        }

        // Find or create user
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: profile.id },
              { email },
            ],
          },
        });

        if (user) {
          // Link Google account if not already linked
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                name: user.name || profile.displayName,
                avatarUrl: user.avatarUrl || profile.photos?.[0]?.value,
                emailVerified: true,
                emailVerifiedAt: new Date(),
              },
            });
          }
        } else {
          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.id,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
          });
        }

        logger.info({ userId: user.id, provider: 'google' }, 'OAuth login');
        done(null, user);
      } catch (error) {
        logger.error({ error }, 'Google OAuth error');
        done(error as Error);
      }
    }
  );
}
```

**Step 2: Add OAuth routes**

Add to `apps/api/src/routes/auth.ts`:

```typescript
import passport from 'passport';
import { createGoogleStrategy } from '../auth/strategies/google.js';

// Initialize Google strategy if configured
const googleStrategy = createGoogleStrategy();
if (googleStrategy) {
  passport.use(googleStrategy);
}

/**
 * GET /auth/google
 * Initiate Google OAuth flow
 */
authRouter.get('/google', (req, res, next) => {
  if (!googleStrategy) {
    res.status(501).json({ error: 'Google OAuth not configured' });
    return;
  }
  passport.authenticate('google', { session: false })(req, res, next);
});

/**
 * GET /auth/google/callback
 * Google OAuth callback
 */
authRouter.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err: any, user: any) => {
    if (err || !user) {
      res.redirect(`${config.corsOrigins[0]}/login?error=oauth_failed`);
      return;
    }

    try {
      const tokens = await createTokens(user.id, user.email, req);
      // Redirect to frontend with tokens (or use secure cookie)
      res.redirect(`${config.corsOrigins[0]}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
    } catch (error) {
      res.redirect(`${config.corsOrigins[0]}/login?error=token_failed`);
    }
  })(req, res, next);
});
```

**Step 3: Commit**

```bash
git add apps/api/src/auth/ apps/api/src/routes/auth.ts
git commit -m "feat(api): add Google OAuth provider"
```

---

## Task 10: Add OAuth GitHub Provider (P1)

**Files:**
- Create: `apps/api/src/auth/strategies/github.ts`
- Modify: `apps/api/src/routes/auth.ts`

Similar to Task 9 but for GitHub. Implementation follows same pattern.

**Step 1: Create GitHub strategy**

Create `apps/api/src/auth/strategies/github.ts`:

```typescript
/**
 * GitHub OAuth Strategy
 */

import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export function createGitHubStrategy() {
  if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
    logger.warn('GitHub OAuth not configured - skipping strategy');
    return null;
  }

  return new GitHubStrategy(
    {
      clientID: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      callbackURL: `${config.oauth.callbackUrl}/github/callback`,
      scope: ['user:email'],
    },
    async (accessToken: string, refreshToken: string, profile: Profile, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email from GitHub'));
        }

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { githubId: profile.id },
              { email },
            ],
          },
        });

        if (user) {
          if (!user.githubId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                githubId: profile.id,
                name: user.name || profile.displayName || profile.username,
                avatarUrl: user.avatarUrl || profile.photos?.[0]?.value,
                emailVerified: true,
                emailVerifiedAt: new Date(),
              },
            });
          }
        } else {
          user = await prisma.user.create({
            data: {
              email,
              githubId: profile.id,
              name: profile.displayName || profile.username,
              avatarUrl: profile.photos?.[0]?.value,
              emailVerified: true,
              emailVerifiedAt: new Date(),
            },
          });
        }

        logger.info({ userId: user.id, provider: 'github' }, 'OAuth login');
        done(null, user);
      } catch (error) {
        logger.error({ error }, 'GitHub OAuth error');
        done(error as Error);
      }
    }
  );
}
```

**Step 2: Add GitHub routes to auth.ts**

Similar pattern to Google OAuth routes.

**Step 3: Commit**

```bash
git add apps/api/src/auth/strategies/github.ts apps/api/src/routes/auth.ts
git commit -m "feat(api): add GitHub OAuth provider"
```

---

## Verification Checklist

After completing all tasks:

- [ ] Run full test suite: `pnpm --filter @ltip/api test`
- [ ] TypeScript compilation: `pnpm --filter @ltip/api exec tsc --noEmit`
- [ ] Test manual registration: `curl -X POST http://localhost:4000/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"SecurePass123!"}'`
- [ ] Test manual login: `curl -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"SecurePass123!"}'`
- [ ] Test WebSocket with token: Connect to ws://localhost:4000/ws?token=<access_token>
- [ ] Security audit: No secrets in code, proper error messages, timing-safe comparisons

---

## Deliverables

| Deliverable | Path | Status |
|-------------|------|--------|
| JWT Service | `apps/api/src/services/jwt.service.ts` | |
| Password Service | `apps/api/src/services/password.service.ts` | |
| Auth Middleware | `apps/api/src/middleware/auth.ts` | |
| Auth Routes | `apps/api/src/routes/auth.ts` | |
| WebSocket Auth (SEC-002) | `apps/api/src/websocket/auth.ts` | |
| Google OAuth | `apps/api/src/auth/strategies/google.ts` | |
| GitHub OAuth | `apps/api/src/auth/strategies/github.ts` | |
| Schema Migration | `apps/api/prisma/migrations/` | |
| Unit Tests | `apps/api/src/__tests__/` | |

---

## Change Control Reference

**Document ID**: CC-2026-01-29-007 (to be created)
**Related**: CC-2026-01-29-005 (QC Report), CC-2026-01-29-006 (Immediate Remediation)
**Issues Resolved**: SEC-001, SEC-002
