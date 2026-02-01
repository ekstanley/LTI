# H-1 Backend Dependency Documentation

**Issue ID**: H-1
**Title**: CSRF Token Exposed to XSS Attacks
**Status**: ⚠️ BLOCKED - Requires Backend Team Coordination
**CVSS Score**: 8.1 (High)
**Priority**: HIGH
**Scheduled**: Sprint 2025-Q1
**Last Updated**: 2026-01-30

---

## Executive Summary

The H-1 CSRF token XSS exposure vulnerability **cannot be fixed with frontend-only changes**. The current implementation stores the CSRF token in a module-scope JavaScript variable, making it accessible to any XSS payload. A complete fix requires backend architectural changes to implement httpOnly cookie-based token storage.

**Blocking Reason**: Frontend has no mechanism to securely store sensitive tokens. The browser's httpOnly cookie feature is the only way to prevent JavaScript access, which requires backend implementation.

---

## Current Vulnerable Implementation

**Location**: `src/lib/api.ts:24`

```typescript
// Line 24 - VULNERABLE: Token accessible to any JavaScript
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken; // ❌ Can be read by XSS payloads
}
```

**Attack Scenario**:
1. Attacker finds an XSS vulnerability anywhere in the application
2. Malicious script is injected: `<script>fetch('/steal?token=' + getCsrfToken())</script>`
3. Attacker obtains the CSRF token
4. Attacker can now make authenticated state-changing requests
5. Complete CSRF protection bypass

**Impact**:
- **Severity**: HIGH (CVSS 8.1)
- **Exploitability**: Medium (requires existing XSS vulnerability)
- **Impact**: Complete CSRF protection bypass, unauthorized actions as authenticated user
- **Scope**: All authenticated users

---

## Required Backend Changes

### 1. Backend: Implement httpOnly Cookie Storage

```typescript
// Backend: Set CSRF token in httpOnly cookie
response.cookie('csrf-token', token, {
  httpOnly: true,      // ✅ Not accessible to JavaScript
  secure: true,        // ✅ HTTPS only
  sameSite: 'strict',  // ✅ CSRF protection
  maxAge: 3600000,     // 1 hour
  path: '/'            // Available to all routes
});

// Backend: Read token from cookie header (server-side only)
const csrfTokenFromCookie = request.cookies['csrf-token'];

// Backend: Compare with header value (double-submit cookie pattern)
const csrfTokenFromHeader = request.headers['x-csrf-token'];

if (csrfTokenFromCookie !== csrfTokenFromHeader) {
  throw new Error('CSRF token mismatch');
}
```

### 2. Backend: Token Refresh Endpoint

```typescript
// POST /api/auth/csrf-refresh
app.post('/api/auth/csrf-refresh', (req, res) => {
  const newToken = generateCsrfToken();

  // Set new token in httpOnly cookie
  res.cookie('csrf-token', newToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000
  });

  // Return new token for frontend to include in X-CSRF-Token header
  res.json({ csrfToken: newToken });
});
```

---

## Required Frontend Changes (Post-Backend Deployment)

### 1. Remove Module-Scope Token Storage

```typescript
// BEFORE (VULNERABLE):
let csrfToken: string | null = null; // ❌ DELETE THIS

export function getCsrfToken(): string | null {
  return csrfToken; // ❌ DELETE THIS
}

// AFTER (SECURE):
// No client-side storage needed!
// Token is managed entirely by backend via httpOnly cookies
```

### 2. Update CSRF Refresh Logic

```typescript
// BEFORE (stores token client-side):
async function fetchCsrfToken(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/auth/csrf-token', { signal });
  const data = await response.json();
  csrfToken = data.csrfToken; // ❌ Client-side storage
}

// AFTER (token in httpOnly cookie):
async function fetchCsrfToken(signal?: AbortSignal): Promise<string> {
  const response = await fetch('/api/auth/csrf-refresh', {
    method: 'POST',
    credentials: 'include', // ✅ Include httpOnly cookie
    signal
  });

  const data = await response.json();
  return data.csrfToken; // ✅ Return for X-CSRF-Token header only
}
```

### 3. Update fetcherCore to Use Double-Submit Pattern

```typescript
async function fetcherCore<T>(
  endpoint: string,
  options?: FetchOptions
): Promise<T> {
  // Fetch fresh token if needed
  const tokenForHeader = await fetchCsrfToken(options?.signal);

  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // ✅ Include httpOnly cookie
    headers: {
      ...options?.headers,
      'X-CSRF-Token': tokenForHeader, // ✅ Header for double-submit validation
      'Content-Type': 'application/json'
    }
  });

  // Backend validates: cookie token === header token
  return response.json();
}
```

---

## Implementation Timeline

### Sprint 2025-Q1 (Target)

**Week 1: Backend Development**
- [ ] Implement httpOnly cookie management (2 hours)
- [ ] Create /api/auth/csrf-refresh endpoint (1 hour)
- [ ] Update CSRF validation middleware (1 hour)
- [ ] Write backend tests (2 hours)
- **Subtotal**: 6 hours

**Week 2: Frontend Integration**
- [ ] Remove client-side token storage (30 min)
- [ ] Update fetchCsrfToken() logic (30 min)
- [ ] Update fetcherCore() for double-submit (1 hour)
- [ ] Write frontend tests (1 hour)
- [ ] Integration testing (1 hour)
- **Subtotal**: 4 hours

**Week 3: Testing & Deployment**
- [ ] Security audit verification (2 hours)
- [ ] Cross-browser testing (1 hour)
- [ ] Staging deployment (1 hour)
- [ ] Production deployment (1 hour)
- [ ] Post-deployment monitoring (1 hour)
- **Subtotal**: 6 hours

**Total Effort**: 16 hours (2 backend developers × 8 hours)

---

## Dependencies

### Backend Team Requirements
- Backend developer with session/auth expertise
- Access to backend codebase and deployment pipeline
- Ability to modify cookie configuration
- API versioning coordination (if needed)

### Frontend Team Requirements
- Frontend developer for client-side changes
- Coordination with backend deployment timing
- Test suite updates
- Documentation updates

### Infrastructure Requirements
- HTTPS enforced (required for `secure: true` cookies)
- Cookie storage enabled
- CORS configuration may need updates
- Session management coordination

---

## Interim Mitigation Strategy

Until backend changes are deployed, the following mitigations reduce (but do not eliminate) risk:

### 1. Comprehensive XSS Prevention ✅ ACTIVE
- Content-Security-Policy (CSP) headers
- Input sanitization on all user inputs
- Output encoding for all dynamic content
- Regular security audits

### 2. Token Export Restriction (Partial Mitigation)
```typescript
// Remove public getCsrfToken() export
// Make token access internal only
// Reduces attack surface but doesn't eliminate vulnerability
```

### 3. Security Monitoring ✅ ACTIVE
- Regular dependency updates (`npm audit`)
- OWASP Top 10 compliance checks
- Penetration testing for XSS vulnerabilities

**Residual Risk**: If an XSS vulnerability exists, CSRF protection can be bypassed. This is an **accepted risk** until backend changes are deployed.

---

## Verification Checklist (Post-Implementation)

Backend verification:
- [ ] CSRF token stored in httpOnly cookie
- [ ] Cookie has `secure: true` and `sameSite: 'strict'`
- [ ] /api/auth/csrf-refresh endpoint functional
- [ ] Double-submit cookie validation working
- [ ] Backend tests passing (95%+ coverage)

Frontend verification:
- [ ] No client-side token storage
- [ ] fetchCsrfToken() returns token for header only
- [ ] All API calls include `credentials: 'include'`
- [ ] X-CSRF-Token header included in all requests
- [ ] Frontend tests passing (98%+ coverage)

Integration verification:
- [ ] Token rotation works across page reloads
- [ ] Token refresh on 403/CSRF_TOKEN_INVALID works
- [ ] No regressions in existing functionality
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Security audit confirms XSS → CSRF bypass eliminated

---

## Communication Plan

### Stakeholder Notifications
- **Backend Team Lead**: Coordinate implementation timeline
- **Frontend Team Lead**: Schedule frontend changes post-backend deployment
- **Security Team**: Review and approve approach
- **Product Manager**: Communicate timeline to business stakeholders

### Status Updates
- **Weekly**: Progress update in engineering standup
- **Bi-weekly**: Security posture report including H-1 status
- **Milestone**: Notify all stakeholders when backend changes deploy

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| XSS vulnerability discovered before fix | MEDIUM | HIGH | Comprehensive XSS prevention, rapid patching |
| Backend deployment delayed | MEDIUM | MEDIUM | Interim mitigations, prioritize in backlog |
| Cookie compatibility issues | LOW | MEDIUM | Cross-browser testing, fallback plan |
| Breaking change in API | LOW | HIGH | API versioning, phased rollout |

**Overall Risk (Current)**: **HIGH** - Depends on XSS prevention effectiveness
**Overall Risk (Post-Fix)**: **LOW** - httpOnly cookies eliminate JavaScript access

---

## References

- **OWASP**: [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- **OWASP**: [httpOnly Cookie Attribute](https://owasp.org/www-community/HttpOnly)
- **MDN**: [Set-Cookie Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- **CVSS Calculator**: [CVSS 8.1 Details](https://www.first.org/cvss/calculator/3.1)

---

**Document Version**: 1.0
**Next Review**: After backend implementation complete
**Owner**: Security Team + Backend Team Lead
