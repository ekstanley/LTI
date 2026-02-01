# Task 4 QC Comprehensive Findings Report

**Document ID**: QC-2026-01-30-001
**Date**: 2026-01-30
**Task**: GitHub Issue #4 - Account Lockout Protection (CWE-307)
**Commit**: b479257ad16ed30a546a0777e526438888e3eb3f
**Status**: ⚠️ COMPLETE WITH CRITICAL FINDINGS - REMEDIATION REQUIRED

---

## Executive Summary

Task 4 (Account Lockout Protection - CWE-307) implementation has been completed with 23 passing tests and functional lockout mechanism. However, comprehensive QC review by three specialized ODIN agents has identified **3 critical security vulnerabilities** that must be remediated before production deployment.

### Overall Assessment

| Dimension | Score | Status | Target |
|-----------|-------|--------|--------|
| **Functional Completeness** | 95/100 | ✅ PASS | 90+ |
| **Code Quality** | 75/100 | ⚠️ WARN | 90+ |
| **Security Posture** | 55/100 | ❌ FAIL | 80+ |
| **Test Coverage** | 78/100 | ⚠️ WARN | 80+ |
| **CWE-307 Compliance** | 45/100 | ❌ FAIL | 90+ |
| **CVSS Risk Score** | 5.3/10 | ⚠️ MEDIUM | <4.0 |

**Recommendation**: **DO NOT DEPLOY TO PRODUCTION** without addressing critical security issues identified below.

---

## QC Review Methodology

Three specialized ODIN agents conducted parallel comprehensive reviews:

1. **odin:code-reviewer** - Code quality, complexity, maintainability analysis
2. **odin:security-auditor** - Security vulnerability assessment (OWASP, CWE, CVSS)
3. **odin:test-writer** - Test coverage gap analysis and missing scenarios

### Review Scope

**Files Analyzed**:
- `apps/api/src/services/auth.service.ts` (lines 100-298: register, login functions)
- `apps/api/src/routes/auth.ts` (lines 130-180: login route handler)
- `apps/api/src/__tests__/services/auth.lockout.test.ts` (599 lines, 23 tests)

**Review Dimensions**:
- Security vulnerabilities (OWASP Top 10, CWE compliance)
- Code quality (complexity, duplication, maintainability)
- Test coverage (scenarios, edge cases, concurrency)
- Compliance (CWE-307, timing attacks, user enumeration)

---

## Critical Findings (P0 - BLOCKER)

### 1. User Enumeration via Distinct Error Message (CWE-203)

**Severity**: HIGH | **CVSS**: 5.3 (MEDIUM) | **Status**: ❌ UNFIXED

**Location**: `apps/api/src/routes/auth.ts:146-149`

**Vulnerable Code**:
```typescript
const errorMessages: Record<string, { status: number; message: string }> = {
  invalid_credentials: { status: 401, message: 'Invalid email or password' },
  account_inactive: { status: 403, message: 'Account is inactive' },
  account_locked: {
    status: 429,
    message: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
    // ^ REVEALS: 1) Account exists, 2) Multiple failed attempts occurred
  },
  internal: { status: 500, message: 'Login failed' },
};
```

**Vulnerability Description**:
The `account_locked` error returns a **distinct message** that confirms:
1. The email address corresponds to a valid account
2. Multiple failed login attempts have occurred
3. The account is currently locked

This enables **account enumeration attacks** where attackers can:
- Identify valid user accounts for targeted phishing
- Build lists of real accounts for credential stuffing
- Prioritize attacks on accounts with multiple failed logins

**Attack Scenario**:
```bash
# Attacker tests if user@example.com exists:
curl -X POST http://api.ltip.gov/auth/login \
  -d '{"email":"user@example.com","password":"wrong"}' \
  -H "Content-Type: application/json"

# Response reveals account exists:
# {"error":"Account temporarily locked due to too many failed login attempts..."}

# vs. non-existent account:
# {"error":"Invalid email or password"}
```

**Impact**:
- **Confidentiality**: Account existence disclosure
- **Attack Surface**: Enables targeted phishing, credential stuffing
- **Compliance**: Violates OWASP A01:2021 (Broken Access Control)

**Remediation** (Effort: 30 minutes):
```typescript
// RECOMMENDED FIX:
account_locked: {
  status: 429,
  message: 'Too many requests. Please try again later.',  // Generic message
}

// Alternative: Return 401 with invalid_credentials for all auth failures
```

**Acceptance Criteria**:
- [ ] All authentication failures return identical error messages
- [ ] Error message does not reveal account existence
- [ ] HTTP status code does not leak information (consider 401 for all)
- [ ] Security audit confirms no account enumeration possible
- [ ] Update tests to verify generic error message returned

---

### 2. Race Condition in Failed Login Counter (CWE-362)

**Severity**: MEDIUM | **CVSS**: 4.3 (MEDIUM) | **Status**: ❌ UNFIXED

**Location**: `apps/api/src/services/auth.service.ts:217-243`

**Vulnerable Code**:
```typescript
// CURRENT (VULNERABLE) - Read-then-increment pattern:
const failedAttempts = user.failedLoginAttempts + 1;  // 1. READ
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const updateData: {
  failedLoginAttempts: number;
  lastFailedLoginAt: Date;
  accountLockedUntil?: Date;
} = {
  failedLoginAttempts: failedAttempts,  // 2. WRITE (non-atomic)
  lastFailedLoginAt: now,
};

if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
  updateData.accountLockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
  logger.warn(
    { userId: user.id, failedAttempts, lockedUntil: updateData.accountLockedUntil },
    'SECURITY: Account locked due to excessive failed login attempts'
  );
}

await prisma.user.update({
  where: { id: user.id },
  data: updateData,
});
```

**Vulnerability Description**:
The failed login counter uses a **non-atomic read-then-increment** pattern. Under concurrent requests:

1. Request A reads `failedLoginAttempts = 4`
2. Request B reads `failedLoginAttempts = 4` (before A writes)
3. Request A writes `failedLoginAttempts = 5` (locks account)
4. Request B writes `failedLoginAttempts = 5` (overwrites A's value!)

**Result**: Both requests see `failedAttempts = 5` but **only one increment is recorded**. With 50 concurrent requests, attacker may achieve 50+ attempts before lockout.

**Attack Scenario**:
```bash
# Attacker sends 50 concurrent failed login attempts:
for i in {1..50}; do
  curl -X POST http://api.ltip.gov/auth/login \
    -d '{"email":"victim@example.com","password":"wrong"}' \
    -H "Content-Type: application/json" &
done
wait

# Expected: Account locked after 5 attempts
# Actual: Multiple increments lost, account may allow 10-50 attempts
```

**Impact**:
- **Security**: Bypass of account lockout protection (CWE-307)
- **Attack Surface**: Distributed brute force attacks can exceed threshold
- **Compliance**: Violates CWE-307 protection requirements

**Remediation** (Effort: 1 hour):
```typescript
// RECOMMENDED FIX - Atomic increment:
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Step 1: Atomically increment and read new value
const updatedUser = await prisma.user.update({
  where: { id: user.id },
  data: {
    failedLoginAttempts: { increment: 1 },  // Atomic increment!
    lastFailedLoginAt: now,
  },
  select: {
    id: true,
    failedLoginAttempts: true,
  }
});

// Step 2: Check threshold and lock if needed
if (updatedUser.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
  const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { accountLockedUntil: lockedUntil },
  });

  logger.warn(
    { userId: user.id, failedAttempts: updatedUser.failedLoginAttempts, lockedUntil },
    'SECURITY: Account locked due to excessive failed login attempts'
  );
}

return { success: false, error: 'invalid_credentials' };
```

**Acceptance Criteria**:
- [ ] Failed login counter uses atomic Prisma increment operation
- [ ] Concurrent login attempts test verifies correct counting (see test below)
- [ ] Under load testing (50 concurrent requests), exactly 5 attempts counted
- [ ] No race conditions detected in concurrency tests
- [ ] Database transactions handle concurrent updates correctly

**Required Test**:
```typescript
it('handles concurrent failed login attempts correctly', async () => {
  const attempts = Array(10).fill(null).map(() =>
    authService.login({ email: testEmail, password: invalidPassword })
  );

  await Promise.all(attempts);  // Execute concurrently

  const user = await prisma.user.findUnique({
    where: { id: testUserId },
    select: { failedLoginAttempts: true, accountLockedUntil: true }
  });

  // All 10 attempts should be counted (not 1-2 due to race condition)
  expect(user?.failedLoginAttempts).toBeGreaterThanOrEqual(5);
  expect(user?.accountLockedUntil).toBeInstanceOf(Date);
});
```

---

### 3. Timing Attack Protection Inconsistency (CWE-208)

**Severity**: LOW | **CVSS**: 3.7 (LOW) | **Status**: ❌ UNFIXED

**Location**: `apps/api/src/services/auth.service.ts:192-194`

**Vulnerable Code**:
```typescript
// OAuth-only user case - NO DUMMY HASH:
if (!user.passwordHash) {
  return { success: false, error: 'invalid_credentials' };  // Fast response!
}

// vs. Invalid credentials case - WITH DUMMY HASH:
if (!user) {
  await passwordService.hash('dummy-password-for-timing');  // Slow response
  return { success: false, error: 'invalid_credentials' };
}
```

**Vulnerability Description**:
The OAuth-only user path **does not perform dummy password hashing**, creating a timing difference:
- OAuth-only user: ~1ms response (no hashing)
- Invalid credentials: ~500ms response (dummy hash with argon2)
- Valid user, wrong password: ~500ms response (real hash verification)

**Result**: Attacker can measure response times to distinguish OAuth-only accounts from password-based accounts.

**Attack Scenario**:
```python
import requests
import time

def measure_login_time(email):
    start = time.perf_counter()
    requests.post('http://api.ltip.gov/auth/login',
                  json={'email': email, 'password': 'test'})
    return time.perf_counter() - start

oauth_user_time = measure_login_time('oauth@example.com')  # ~1ms
password_user_time = measure_login_time('password@example.com')  # ~500ms

# If response < 50ms: OAuth-only account
# If response > 400ms: Password-based account
```

**Impact**:
- **Information Disclosure**: Account authentication method revealed
- **Attack Surface**: Enables targeted attacks on password-based accounts
- **Severity**: Low (requires many samples, limited practical impact)

**Remediation** (Effort: 15 minutes):
```typescript
// RECOMMENDED FIX - Add dummy hash for OAuth-only users:
if (!user.passwordHash) {
  await passwordService.hash('dummy-password-for-timing');  // Consistent timing
  return { success: false, error: 'invalid_credentials' };
}
```

**Acceptance Criteria**:
- [ ] All authentication failure paths perform dummy hash
- [ ] Timing attack test verifies consistent response times (±20% variance)
- [ ] OAuth-only and password-based paths have similar timing
- [ ] Security audit confirms no timing-based account enumeration

**Required Test**:
```typescript
it('maintains consistent response time for OAuth-only vs password users', async () => {
  const oauthUserTimings: number[] = [];
  const passwordUserTimings: number[] = [];

  // Measure OAuth-only user (no passwordHash)
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await authService.login({ email: oauthUserEmail, password: 'wrong' });
    oauthUserTimings.push(performance.now() - start);
  }

  // Measure password-based user
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await authService.login({ email: testEmail, password: invalidPassword });
    passwordUserTimings.push(performance.now() - start);
  }

  const avgOAuthTiming = oauthUserTimings.reduce((a, b) => a + b) / 5;
  const avgPasswordTiming = passwordUserTimings.reduce((a, b) => a + b) / 5;

  // Timing difference should be within 20%
  const maxVariance = avgPasswordTiming * 0.2;
  expect(Math.abs(avgOAuthTiming - avgPasswordTiming)).toBeLessThan(maxVariance);
});
```

---

## High Priority Issues (P1)

### 4. Configuration Hardcoding (Code Quality)

**Location**: `apps/api/src/services/auth.service.ts:219-220`

**Issue**:
```typescript
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
```

Security thresholds are hardcoded **magic numbers** buried in business logic.

**Impact**:
- Cannot adjust thresholds without code changes
- Difficult to test different configurations
- Operational risk for compliance requirements (e.g., PCI-DSS may require different thresholds)

**Remediation** (Effort: 30 minutes):
```typescript
// config/security.config.ts:
export const SECURITY_CONFIG = {
  AUTH: {
    MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10),
    LOCKOUT_DURATION_MINUTES: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
    get LOCKOUT_DURATION_MS() {
      return this.LOCKOUT_DURATION_MINUTES * 60 * 1000;
    },
  }
} as const;

// Usage in auth.service.ts:
import { SECURITY_CONFIG } from '../config/security.config.js';

const MAX_FAILED_ATTEMPTS = SECURITY_CONFIG.AUTH.MAX_FAILED_ATTEMPTS;
const LOCKOUT_DURATION_MS = SECURITY_CONFIG.AUTH.LOCKOUT_DURATION_MS;
```

---

### 5. No IP-Based Rate Limiting (Security Gap)

**Status**: ❌ MISSING

**Issue**: Current implementation only tracks failed attempts **per account**. Attacker can:
- Test 4 attempts on user1@example.com
- Test 4 attempts on user2@example.com
- Test 4 attempts on user3@example.com
- **Result**: 12 attempts from same IP without any lockout

**Impact**:
- Distributed brute force across multiple accounts
- No protection against credential stuffing attacks
- Violates OWASP A07:2021 (Identification and Authentication Failures)

**Remediation** (Effort: 3-4 hours):
```typescript
// middleware/rateLimit.middleware.ts:
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP per window
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'SECURITY: Rate limit exceeded for auth endpoint');
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

// routes/auth.ts:
router.post('/login', authRateLimiter, async (req, res) => { ... });
```

---

### 6. No CAPTCHA After Failed Attempts (Security Enhancement)

**Status**: ❌ MISSING

**Issue**: After 2-3 failed attempts, no CAPTCHA challenge is presented. Enables:
- Automated brute force attacks
- Credential stuffing with scripts
- Low-effort password guessing

**Impact**:
- Increases effectiveness of automated attacks
- No human verification before account lockout
- Poor defense-in-depth strategy

**Remediation** (Effort: 6-8 hours):
```typescript
// After 3 failed attempts, require CAPTCHA:
if (user.failedLoginAttempts >= 3) {
  if (!req.body.captchaToken) {
    return res.status(400).json({
      error: 'captcha_required',
      message: 'Please complete the CAPTCHA challenge.'
    });
  }

  const captchaValid = await verifyCaptcha(req.body.captchaToken);
  if (!captchaValid) {
    return res.status(400).json({
      error: 'captcha_invalid',
      message: 'CAPTCHA verification failed.'
    });
  }
}
```

**Requires**:
- reCAPTCHA v3 integration
- Frontend CAPTCHA component
- Backend verification logic
- Configuration for CAPTCHA keys

---

### 7. No User Notification on Lockout (UX/Security)

**Status**: ❌ MISSING

**Issue**: When account is locked, user receives no notification:
- No email alert about suspicious activity
- No warning before final attempt
- No instructions for account recovery

**Impact**:
- Poor user experience (unexpected lockout)
- User unaware of potential attack
- No guidance for next steps

**Remediation** (Effort: 2-3 hours):
```typescript
// After 4th failed attempt (warning):
if (failedAttempts === MAX_FAILED_ATTEMPTS - 1) {
  await sendEmail({
    to: user.email,
    subject: 'Security Alert: Login Attempt Warning',
    template: 'login-warning',
    data: {
      name: user.name,
      attemptsRemaining: 1,
      timestamp: new Date()
    }
  });
}

// After lockout:
if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
  await sendEmail({
    to: user.email,
    subject: 'Security Alert: Account Temporarily Locked',
    template: 'account-locked',
    data: {
      name: user.name,
      lockedUntil: updateData.accountLockedUntil,
      unlockInstructions: 'Your account will automatically unlock in 15 minutes.'
    }
  });
}
```

---

### 8. User ID Exposure in Security Logs

**Location**: `apps/api/src/services/auth.service.ts:207, 235`

**Issue**:
```typescript
logger.warn(
  { userId: user.id, lockedUntil: user.accountLockedUntil },
  'SECURITY: Login attempt on locked account'
);
```

Logs contain **user.id** which may be considered PII depending on regulations.

**Impact**:
- Potential GDPR/privacy violation if logs are shared
- User ID may correlate with other data
- Recommended to use pseudonymized identifiers in logs

**Remediation** (Effort: 1 hour):
```typescript
// Option 1: Hash user ID in logs
const hashedUserId = crypto.createHash('sha256').update(user.id).digest('hex').substring(0, 16);
logger.warn(
  { userIdHash: hashedUserId, lockedUntil: user.accountLockedUntil },
  'SECURITY: Login attempt on locked account'
);

// Option 2: Use session ID instead
logger.warn(
  { sessionId: req.sessionID, lockedUntil: user.accountLockedUntil },
  'SECURITY: Login attempt on locked account'
);
```

---

### 9. Function Complexity: login() Method

**Location**: `apps/api/src/services/auth.service.ts:165-298`

**Metrics**:
- **Lines**: 133 lines
- **Cyclomatic Complexity**: 9-10 (threshold: 10)
- **Cognitive Complexity**: ~12 (threshold: 15)

**Issue**: The `login()` function handles:
- User lookup
- Password verification
- Account status checks (inactive, locked)
- Failed attempt tracking
- Account locking logic
- Token generation
- Logging

**Impact**:
- Difficult to test all paths
- High maintenance burden
- Easy to introduce bugs in complex logic

**Remediation** (Effort: 3-4 hours):
```typescript
// Refactor into smaller functions:
async function verifyUserCredentials(email: string, password: string) { ... }
async function checkAccountStatus(user: User) { ... }
async function handleFailedLogin(userId: string) { ... }
async function handleSuccessfulLogin(user: User, input: LoginInput) { ... }

async function login(input: LoginInput): Promise<LoginResponse> {
  const user = await verifyUserCredentials(input.email, input.password);
  if (!user) return { success: false, error: 'invalid_credentials' };

  const statusCheck = await checkAccountStatus(user);
  if (!statusCheck.ok) return statusCheck.error;

  return await handleSuccessfulLogin(user, input);
}
```

---

## Test Coverage Gaps

### Overall Test Assessment

| Category | Coverage | Status | Missing Scenarios |
|----------|----------|--------|------------------|
| **Basic Login** | 100% | ✅ | None |
| **Failed Login Tracking** | 100% | ✅ | None |
| **Account Locking** | 95% | ✅ | Exact threshold boundary |
| **Auto-Unlock** | 100% | ✅ | None |
| **Security Features** | 70% | ⚠️ | Timing attacks, concurrency |
| **Edge Cases** | 60% | ⚠️ | DB failures, state recovery |
| **Concurrency** | 0% | ❌ | All scenarios |

### Critical Missing Tests

#### 1. Concurrent Login Attempts (Priority: P0)
```typescript
describe('Concurrency Tests', () => {
  it('handles concurrent failed login attempts correctly', async () => {
    const attempts = Array(10).fill(null).map(() =>
      authService.login({ email: testEmail, password: invalidPassword })
    );

    await Promise.all(attempts);

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { failedLoginAttempts: true, accountLockedUntil: true }
    });

    expect(user?.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(user?.accountLockedUntil).toBeInstanceOf(Date);
  });

  it('prevents race condition with mixed success/failure attempts', async () => {
    const attempts = [
      authService.login({ email: testEmail, password: invalidPassword }),
      authService.login({ email: testEmail, password: testPassword }),
      authService.login({ email: testEmail, password: invalidPassword }),
    ];

    const results = await Promise.all(attempts);

    // One success should reset counter
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(1);

    // Counter should be consistent
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { failedLoginAttempts: true }
    });
    expect(user?.failedLoginAttempts).toBe(0); // Reset after success
  });
});
```

#### 2. Timing Attack Protection (Priority: P0)
```typescript
describe('Timing Attack Protection', () => {
  it('maintains consistent response time for valid vs invalid users', async () => {
    const timings: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await authService.login({ email: testEmail, password: invalidPassword });
      timings.push(performance.now() - start);
    }

    const start = performance.now();
    await authService.login({
      email: 'nonexistent@example.com',
      password: invalidPassword
    });
    const nonExistentTiming = performance.now() - start;

    const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
    const maxVariance = avgTiming * 0.2; // 20% variance allowed

    expect(Math.abs(nonExistentTiming - avgTiming)).toBeLessThan(maxVariance);
  });

  it('maintains consistent response time for OAuth-only vs password users', async () => {
    // Create OAuth-only user (no password)
    const oauthUser = await prisma.user.create({
      data: {
        email: 'oauth@example.com',
        passwordHash: null, // OAuth-only
        emailVerified: true,
        isActive: true
      }
    });

    const oauthTimings: number[] = [];
    const passwordTimings: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start1 = performance.now();
      await authService.login({ email: oauthUser.email, password: 'wrong' });
      oauthTimings.push(performance.now() - start1);

      const start2 = performance.now();
      await authService.login({ email: testEmail, password: 'wrong' });
      passwordTimings.push(performance.now() - start2);
    }

    const avgOAuth = oauthTimings.reduce((a, b) => a + b) / 5;
    const avgPassword = passwordTimings.reduce((a, b) => a + b) / 5;

    expect(Math.abs(avgOAuth - avgPassword)).toBeLessThan(avgPassword * 0.2);
  });
});
```

#### 3. Database Failure Handling (Priority: P1)
```typescript
describe('Error Handling', () => {
  it('handles database failure during counter increment gracefully', async () => {
    vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(
      new Error('Database connection lost')
    );

    const result = await authService.login({
      email: testEmail,
      password: invalidPassword
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('internal');
  });

  it('handles inconsistent state after partial transaction failure', async () => {
    // Simulate: increment succeeds, lock update fails
    let callCount = 0;
    vi.spyOn(prisma.user, 'update').mockImplementation(async (args) => {
      callCount++;
      if (callCount === 2) throw new Error('Lock update failed');
      return prisma.user.update(args);
    });

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await authService.login({ email: testEmail, password: invalidPassword })
        .catch(() => {}); // Swallow expected error
    }

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { failedLoginAttempts: true, accountLockedUntil: true }
    });

    // Should still track attempts even if lock failed
    expect(user?.failedLoginAttempts).toBeGreaterThanOrEqual(5);
  });
});
```

#### 4. Multiple User Isolation (Priority: P2)
```typescript
it('handles lockout independently across multiple users', async () => {
  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      passwordHash: await passwordService.hash('password123'),
      emailVerified: true,
      isActive: true
    }
  });

  // Lock user1
  for (let i = 0; i < 5; i++) {
    await authService.login({ email: testEmail, password: 'wrong' });
  }

  // user2 should still be able to login
  const result = await authService.login({
    email: user2.email,
    password: 'password123'
  });

  expect(result.success).toBe(true);

  // user1 should still be locked
  const locked = await authService.login({
    email: testEmail,
    password: testPassword
  });
  expect(locked.success).toBe(false);
  expect(locked.error).toBe('account_locked');
});
```

---

## ODIN-Compliant Remediation Tasks

### Task R1: Fix User Enumeration Vulnerability

**Priority**: P0 CRITICAL
**Effort**: 30 minutes
**Assignee**: Security Team
**Dependencies**: None

**Acceptance Criteria**:
- [ ] All authentication failures return identical error message
- [ ] HTTP status code does not leak account information
- [ ] Security audit confirms no enumeration possible
- [ ] Tests verify generic error messages

**Files to Modify**:
- `apps/api/src/routes/auth.ts` (lines 146-149)
- `apps/api/src/__tests__/services/auth.lockout.test.ts` (update assertions)

**Risk Assessment**:
- **Technical Risk**: LOW (simple message change)
- **Business Risk**: NONE (improves security, no functionality change)
- **Deployment Risk**: LOW (backward compatible)

---

### Task R2: Fix Race Condition in Counter

**Priority**: P0 CRITICAL
**Effort**: 1-2 hours
**Assignee**: Backend Team
**Dependencies**: None

**Acceptance Criteria**:
- [ ] Failed login counter uses atomic Prisma increment
- [ ] Concurrent test verifies correct counting under load
- [ ] 50 concurrent requests result in accurate count
- [ ] No race conditions detected

**Files to Modify**:
- `apps/api/src/services/auth.service.ts` (lines 217-243)
- `apps/api/src/__tests__/services/auth.lockout.test.ts` (add concurrent test)

**Risk Assessment**:
- **Technical Risk**: MEDIUM (database transaction changes)
- **Business Risk**: NONE (fixes vulnerability)
- **Deployment Risk**: MEDIUM (requires thorough testing)

**Testing Plan**:
1. Unit test: Concurrent login attempts (10-50 requests)
2. Integration test: Real database under load
3. Load test: k6 script with 100 concurrent users
4. Verify: No database deadlocks, correct counting

---

### Task R3: Fix Timing Attack Inconsistency

**Priority**: P1 HIGH
**Effort**: 15 minutes
**Assignee**: Backend Team
**Dependencies**: None

**Acceptance Criteria**:
- [ ] All auth failure paths perform dummy hash
- [ ] Timing test verifies consistent response times
- [ ] OAuth-only and password paths have similar timing (±20%)
- [ ] Security audit confirms no timing-based enumeration

**Files to Modify**:
- `apps/api/src/services/auth.service.ts` (lines 192-194)
- `apps/api/src/__tests__/services/auth.lockout.test.ts` (add timing test)

**Risk Assessment**:
- **Technical Risk**: LOW (add one line)
- **Business Risk**: NONE
- **Deployment Risk**: LOW

---

### Task R4: Extract Configuration to Environment Variables

**Priority**: P1 HIGH
**Effort**: 30 minutes
**Assignee**: Backend Team
**Dependencies**: None

**Acceptance Criteria**:
- [ ] MAX_FAILED_ATTEMPTS configurable via env var
- [ ] LOCKOUT_DURATION configurable via env var
- [ ] Configuration validated on startup
- [ ] Documentation updated

**Files to Modify**:
- `apps/api/src/config/security.config.ts` (new file)
- `apps/api/src/services/auth.service.ts` (import config)
- `apps/api/.env.example` (add new vars)
- `docs/CONFIGURATION.md` (document vars)

**Risk Assessment**:
- **Technical Risk**: LOW (straightforward refactor)
- **Business Risk**: NONE
- **Deployment Risk**: MEDIUM (requires env var updates)

---

### Task R5: Implement IP-Based Rate Limiting

**Priority**: P1 HIGH
**Effort**: 3-4 hours
**Assignee**: Backend Team
**Dependencies**: express-rate-limit package

**Acceptance Criteria**:
- [ ] Rate limiter middleware added to auth routes
- [ ] 20 requests per IP per 15-minute window
- [ ] HTTP 429 returned when limit exceeded
- [ ] Security logs track rate limit violations
- [ ] Tests verify rate limiting works

**Files to Create/Modify**:
- `apps/api/src/middleware/rateLimit.middleware.ts` (new)
- `apps/api/src/routes/auth.ts` (add middleware)
- `apps/api/src/__tests__/middleware/rateLimit.test.ts` (new)

**Risk Assessment**:
- **Technical Risk**: MEDIUM (requires testing with proxies, load balancers)
- **Business Risk**: LOW (may impact legitimate users with strict limits)
- **Deployment Risk**: MEDIUM (monitor rate limit false positives)

**Testing Plan**:
1. Unit test: Rate limiter middleware logic
2. Integration test: Auth routes with rate limiter
3. Load test: Verify 429 returned after limit
4. Manual test: Behind proxy/load balancer (X-Forwarded-For)

---

### Task R6: Add Missing Test Scenarios

**Priority**: P1 HIGH
**Effort**: 2-3 hours
**Assignee**: QA/Test Team
**Dependencies**: Tasks R1, R2, R3 complete

**Acceptance Criteria**:
- [ ] Concurrent login attempts test added
- [ ] Timing attack protection test added
- [ ] Database failure handling test added
- [ ] Multiple user isolation test added
- [ ] All tests pass
- [ ] Test coverage ≥85%

**Files to Modify**:
- `apps/api/src/__tests__/services/auth.lockout.test.ts`

**Risk Assessment**:
- **Technical Risk**: LOW (test-only changes)
- **Business Risk**: NONE
- **Deployment Risk**: NONE

---

### Task R7: Implement CAPTCHA After Failed Attempts (Optional)

**Priority**: P2 MEDIUM
**Effort**: 6-8 hours
**Assignee**: Full Stack Team
**Dependencies**: reCAPTCHA v3, Frontend integration

**Acceptance Criteria**:
- [ ] CAPTCHA required after 3 failed attempts
- [ ] Backend verifies CAPTCHA token
- [ ] Frontend displays CAPTCHA challenge
- [ ] Configuration for CAPTCHA keys
- [ ] Tests verify CAPTCHA enforcement

**Files to Create/Modify**:
- `apps/api/src/services/captcha.service.ts` (new)
- `apps/api/src/routes/auth.ts` (add CAPTCHA check)
- `apps/web/src/components/CaptchaChallenge.tsx` (new)
- `apps/api/.env.example` (RECAPTCHA_SECRET_KEY)

**Risk Assessment**:
- **Technical Risk**: MEDIUM (third-party integration)
- **Business Risk**: MEDIUM (may impact UX)
- **Deployment Risk**: HIGH (requires frontend + backend coordination)

**Deferred**: Consider for Phase 3 (not blocking for Phase 2)

---

### Task R8: Add User Notification on Lockout (Optional)

**Priority**: P3 LOW
**Effort**: 2-3 hours
**Assignee**: Backend Team
**Dependencies**: Email service configured

**Acceptance Criteria**:
- [ ] Email sent after 4th failed attempt (warning)
- [ ] Email sent when account locked
- [ ] Email templates created
- [ ] Configuration for email service
- [ ] Tests verify email sending

**Files to Create/Modify**:
- `apps/api/src/services/auth.service.ts` (add email calls)
- `apps/api/src/templates/email/login-warning.html` (new)
- `apps/api/src/templates/email/account-locked.html` (new)

**Risk Assessment**:
- **Technical Risk**: LOW
- **Business Risk**: NONE (improves UX)
- **Deployment Risk**: LOW

**Deferred**: Consider for Phase 3 (nice-to-have feature)

---

## Compliance Assessment

### CWE-307: Improper Restriction of Excessive Authentication Attempts

| Requirement | Status | Details |
|-------------|--------|---------|
| **Limit failed attempts** | ✅ PASS | 5 attempts before lockout |
| **Lockout mechanism** | ⚠️ PARTIAL | Race condition allows bypass |
| **Lockout duration** | ✅ PASS | 15 minutes (configurable needed) |
| **Counter persistence** | ✅ PASS | Stored in database |
| **Reset after success** | ✅ PASS | Counter reset on valid login |
| **Rate limiting** | ❌ FAIL | No IP-based rate limiting |
| **Timing protection** | ⚠️ PARTIAL | Inconsistency in OAuth-only case |
| **Enumeration protection** | ❌ FAIL | Distinct error reveals account |

**Overall Compliance**: 45/100 (FAILING)
**Required for Pass**: ≥90/100

---

### OWASP Top 10 2021 Assessment

| Category | Status | Issues |
|----------|--------|--------|
| **A01: Broken Access Control** | ⚠️ WARN | User enumeration (Finding #1) |
| **A02: Cryptographic Failures** | ✅ PASS | argon2id used correctly |
| **A03: Injection** | ✅ PASS | Parameterized queries |
| **A04: Insecure Design** | ⚠️ WARN | No IP rate limiting (Finding #5) |
| **A05: Security Misconfiguration** | ⚠️ WARN | Hardcoded config (Finding #4) |
| **A06: Vulnerable Components** | ✅ PASS | Dependencies up to date |
| **A07: Auth Failures** | ❌ FAIL | Race condition (Finding #2), No CAPTCHA |
| **A08: Data Integrity Failures** | ✅ PASS | Proper validation |
| **A09: Logging Failures** | ⚠️ WARN | User ID in logs (Finding #8) |
| **A10: SSRF** | ✅ PASS | Not applicable |

**Overall OWASP Score**: 6/10 (Fair)
**Required for Pass**: ≥8/10

---

## Recommendations

### Immediate Actions (Before Production Deploy)

1. **Fix Critical Vulnerabilities** (P0):
   - Task R1: User enumeration (30 min)
   - Task R2: Race condition (1-2 hours)
   - Task R3: Timing attack (15 min)

   **Total Effort**: 2-3 hours
   **Blocking**: YES - Must complete before production

2. **Add Critical Tests** (P0):
   - Task R6: Concurrent login test (1 hour)
   - Timing attack test (30 min)

   **Total Effort**: 1.5 hours
   **Blocking**: YES - Required for validation

3. **Extract Configuration** (P1):
   - Task R4: Environment variables (30 min)

   **Total Effort**: 30 minutes
   **Blocking**: NO - But highly recommended

### Short-Term Actions (Phase 2)

4. **Implement Rate Limiting** (P1):
   - Task R5: IP-based rate limiting (3-4 hours)

   **Total Effort**: 3-4 hours
   **Blocking**: NO - But critical for production

5. **Complete Test Suite** (P1):
   - Task R6: Remaining test scenarios (2-3 hours)

   **Total Effort**: 2-3 hours
   **Blocking**: NO - But required for confidence

### Future Enhancements (Phase 3)

6. **CAPTCHA Integration** (P2):
   - Task R7: reCAPTCHA v3 (6-8 hours)

   **Total Effort**: 6-8 hours
   **Blocking**: NO - Nice-to-have

7. **User Notifications** (P3):
   - Task R8: Email alerts (2-3 hours)

   **Total Effort**: 2-3 hours
   **Blocking**: NO - UX improvement

---

## Risk Summary

### Security Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|
| **Account enumeration** | HIGH | HIGH | MEDIUM | Fix R1 (generic errors) |
| **Lockout bypass** | MEDIUM | MEDIUM | HIGH | Fix R2 (atomic increment) |
| **Distributed brute force** | HIGH | MEDIUM | HIGH | Implement R5 (IP rate limit) |
| **Timing-based enumeration** | LOW | LOW | LOW | Fix R3 (consistent timing) |
| **Automated attacks** | MEDIUM | HIGH | MEDIUM | Implement R7 (CAPTCHA) |

### Implementation Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Race condition fix breaks tests** | MEDIUM | MEDIUM | Thorough testing, gradual rollout |
| **Rate limiting false positives** | MEDIUM | LOW | Monitor logs, adjust thresholds |
| **Performance degradation** | LOW | MEDIUM | Load testing, caching strategies |
| **Configuration errors** | MEDIUM | HIGH | Validation, documentation |

---

## Next Steps

### Immediate (Today)

1. ✅ Complete QC review documentation (this document)
2. ⬜ Update CHANGE-CONTROL.md with Task 4 completion + QC findings
3. ⬜ Update GitHub Issue #4 with remediation tasks
4. ⬜ Create new GitHub issues for R1-R6 remediation tasks

### Short-Term (This Week)

5. ⬜ Implement critical fixes (R1, R2, R3) - **2-3 hours**
6. ⬜ Add critical tests (concurrent, timing) - **1.5 hours**
7. ⬜ Run full test suite + security audit
8. ⬜ Deploy fixes to staging environment
9. ⬜ Conduct penetration testing

### Medium-Term (Next Week)

10. ⬜ Implement IP-based rate limiting (R5) - **3-4 hours**
11. ⬜ Extract configuration to env vars (R4) - **30 min**
12. ⬜ Complete test suite (R6) - **2-3 hours**
13. ⬜ Security audit with OWASP ZAP
14. ⬜ Deploy to production (if all checks pass)

---

## Approval

**QC Review Conducted By**: ODIN Multi-Agent System
**Date**: 2026-01-30
**Agents**:
- odin:code-reviewer (Code Quality Score: 75/100)
- odin:security-auditor (Security Score: 55/100)
- odin:test-writer (Test Coverage: 78/100)

**Overall Assessment**: **COMPLETE WITH CRITICAL FINDINGS - REMEDIATION REQUIRED**

**Recommendation**: **DO NOT DEPLOY TO PRODUCTION** until critical vulnerabilities (R1, R2, R3) are fixed and validated.

**Next Review**: After remediation tasks R1-R3 complete

---

## References

- **CWE-307**: Improper Restriction of Excessive Authentication Attempts
- **CWE-203**: Observable Discrepancy (Information Disclosure)
- **CWE-362**: Concurrent Execution using Shared Resource with Improper Synchronization (Race Condition)
- **CWE-208**: Observable Timing Discrepancy
- **OWASP Top 10 2021**: https://owasp.org/Top10/
- **CVSS v3.1 Calculator**: https://www.first.org/cvss/calculator/3.1

---

**Document Status**: FINAL
**Distribution**: Engineering Team, Security Team, QA Team
**Confidentiality**: Internal Use Only
