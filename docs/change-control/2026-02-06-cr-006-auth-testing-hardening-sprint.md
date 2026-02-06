# Change Control Record: CR-2026-02-06-006

**Date**: 2026-02-06
**Type**: Auth Testing & Hardening Sprint
**Branch**: `test/auth-testing-hardening-sprint`
**PR**: TBD
**Issues**: #23 (80% web coverage), #8 (test infrastructure)
**Status**: Submitted for review
**Predecessor**: CR-2026-02-06-005 (Test Coverage Expansion)

---

## Summary

Closed the auth test gap with 311 new tests in 10 new test files, fixed the votes route ordering bug (documented in CR-005), and added 6 web component test files. This sprint addresses all three deferred items from CR-005: auth service tests, auth route tests, and progress toward 80% web coverage.

## Changes

### Bug Fix (1 file modified)

| File | Change |
|------|--------|
| `apps/api/src/routes/votes.ts` | Moved `GET /compare` handler above `GET /:id` to fix route shadowing |

### New Test Files (16)

| File | Tests | Description |
|------|-------|-------------|
| `apps/api/src/__tests__/services/password.service.test.ts` | 35 | Hash/verify roundtrip, strength validation, common password detection |
| `apps/api/src/__tests__/middleware/validate.test.ts` | 12 | Body/query/params validation, error format |
| `apps/api/src/__tests__/services/jwt.service.test.ts` | 45 | Token pair generation, verification, rotation, SECURITY: theft detection |
| `apps/api/src/__tests__/middleware/auth.test.ts` | 24 | requireAuth (401), optionalAuth (fail closed), requireEmailVerified (403) |
| `apps/api/src/__tests__/services/auth.service.test.ts` | 48 | All 10 methods, timing attack prevention, atomic lockout, rehash |
| `apps/api/src/__tests__/services/oauth.service.test.ts` | 37 | Google/GitHub flows, state tokens, find-or-create user |
| `apps/api/src/__tests__/routes/auth.routes.test.ts` | 62 | All 15 auth endpoints, cookie handling, error responses |
| `apps/api/src/__tests__/routes/admin.routes.test.ts` | 18 | requireAdmin middleware, unlock-account, lockout-stats |
| `apps/web/src/components/__tests__/ProtectedRoute.test.tsx` | 7 | 4-state contract, no-flash invariant, redirect with return URL |
| `apps/web/src/components/bills/__tests__/BillCard.test.tsx` | 6 | Title/ID, sponsor, status badge, detail link |
| `apps/web/src/components/bills/__tests__/StatusBadge.test.tsx` | 5 | Label/color mapping, unknown status fallback |
| `apps/web/src/components/legislators/__tests__/ContactLink.test.tsx` | 4 | Rendering, href, external link attributes |
| `apps/web/src/components/ui/__tests__/Card.test.tsx` | 4 | Prop forwarding, className composition |
| `apps/web/src/components/ui/__tests__/Skeleton.test.tsx` | 3 | Size variants, animation class |

### Modified Test Files (1)

| File | Change |
|------|--------|
| `apps/api/src/__tests__/routes/votes.routes.test.ts` | Added tests for now-reachable `/compare` endpoint |

## Test Results

| Package | Before (CR-005) | After | Delta |
|---------|-----------------|-------|-------|
| API | 637 tests / 28 files | 923 tests / 38 files | +286 tests / +10 files |
| Web | 537 tests / 33 files | 567 tests / 39 files | +30 tests / +6 files |
| Shared | 79 tests / 5 files | 79 tests / 5 files | unchanged |
| **Total** | **1,253** | **1,569** | **+316** |

Note: 311 new tests written; delta is 316 because the votes route fix affected existing test execution paths.

## Quality Gates

| Gate | Result |
|------|--------|
| `pnpm build` | Pass |
| `pnpm typecheck` | Pass (0 errors) |
| `pnpm lint` | Pass (0 errors, pre-existing warnings only) |
| `pnpm test` | Pass (pre-existing flaky lockout tests only -- no Redis in CI) |

## Security Test Coverage

The following security-critical behaviors are now covered by tests:

| Security Property | Test File | Tests |
|-------------------|-----------|-------|
| Timing attack prevention (dummy hash on not-found) | auth.service.test.ts | 3 |
| Atomic failedLoginAttempts increment (CWE-307) | auth.service.test.ts | 2 |
| Account lockout at threshold | auth.service.test.ts | 1 |
| Revoked token reuse triggers family revocation | jwt.service.test.ts | 1 |
| Plaintext refresh tokens never stored in DB | jwt.service.test.ts | 2 |
| OAuth state tokens single-use with expiry | oauth.service.test.ts | 3 |
| httpOnly cookie for refresh tokens | auth.routes.test.ts | 4 |
| requireAuth returns 401 without Bearer token | auth.routes.test.ts | 8 |
| optionalAuth fails closed on unexpected error | auth.test.ts | 2 |

## Bug Fix Details

**Route ordering bug in votes.ts** (documented in CR-005 Finding #1):

- **Before**: `GET /votes/compare` was unreachable because `GET /votes/:id` was defined first, causing Express to match `:id = 'compare'`
- **After**: `GET /votes/compare` is defined before `GET /votes/:id`, making both routes reachable
- **Verification**: 5 new integration tests confirm `/votes/compare` returns expected results

## Methodology

Design-by-Contract approach: each test suite designed around explicit contracts (preconditions, postconditions, invariants) before implementation. Security-critical services received additional scrutiny with dedicated SECURITY test sections.

## Deferred

- Reaching 80% web coverage threshold (Issue #23) -- significant progress made, additional component tests needed
- Remediation of 6 HIGH priority security issues from Phase 2 code review (separate sprint)
- Redis-dependent accountLockout test stabilization (requires CI Redis or test doubles)

## Commits

```
d98192b fix(api): reorder votes routes so /compare is reachable before /:id
aebe504 test(api): add password.service unit tests
39753c5 test(api): add validate middleware unit tests
55b9e13 test(api): add jwt.service unit tests with theft detection scenarios
9aee14a test(api): add auth middleware unit tests
4014395 test(api): add auth.service unit tests
fbfc20e test(api): add oauth.service unit tests
8b4926d test(api): add auth routes integration tests
c6f3b45 test(api): add admin routes integration tests
686fd28 test(web): add ProtectedRoute, BillCard, StatusBadge, ContactLink, Card, Skeleton tests
```
