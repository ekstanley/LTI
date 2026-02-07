# Change Control Record: CR-008 — Phase 2 Completion Sprint

**Date**: 2026-02-06
**Author**: ODIN Agent
**Branch**: `feature/phase2-completion-sprint`
**PR**: #46
**Status**: Open

---

## Summary

Phase 2 Completion Sprint addressing 6 MEDIUM-priority items from the 2026-02-02 code review. Implements database-driven RBAC, configurable Redis/lockout thresholds, and AsyncState discriminated union types.

---

## Changes

### Stream A: RBAC + Admin Hardening (Code Review Items #1, #10, #11)

**Problem**: Admin authorization relied on `ADMIN_EMAILS` environment variable — fragile, not auditable, no database backing.

**Solution**:
1. Added `UserRole` enum (`USER`, `ADMIN`) to Prisma schema with migration
2. `requireAdmin` middleware now checks `req.user.role === 'admin'` instead of env var
3. Auth middleware selects `role` from database and maps `USER`/`ADMIN` to lowercase at API boundary via `ROLE_MAP`
4. Admin endpoints rate-limited at 30 requests per 15 minutes via `express-rate-limit`
5. Structured audit logging added for login attempts, token refresh, and admin actions

**Files modified** (12):
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260206000000_add_user_role/migration.sql` (new)
- `apps/api/prisma/migrations/migration_lock.toml` (new)
- `apps/api/src/types/express.d.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/auth.service.ts`
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/__tests__/middleware/auth.test.ts`
- `apps/api/src/__tests__/routes/admin.routes.test.ts`
- `apps/api/src/__tests__/routes/auth.routes.test.ts`
- `apps/api/src/__tests__/services/auth.service.test.ts`

### Stream B: Redis & Lockout Config (Code Review Items #8, #9, #14)

**Problem**: Redis connection settings and account lockout thresholds were hardcoded, preventing environment-specific tuning.

**Solution**:
1. Added 9 env vars to Zod config schema: `REDIS_MAX_RETRIES_PER_REQUEST`, `REDIS_RETRY_MAX_ATTEMPTS`, `REDIS_RETRY_MAX_DELAY_MS`, `LOCKOUT_MAX_ATTEMPTS`, `LOCKOUT_WINDOW_SECONDS`, `LOCKOUT_DURATION_FIRST/SECOND/THIRD/EXTENDED`
2. Replaced hardcoded `LOCKOUT_CONFIG` constant with `getLockoutConfig()` function reading from centralized config
3. Updated Redis client constructor to use `config.redis.*`
4. All defaults match OWASP recommendations

**Files modified** (4):
- `apps/api/src/config.ts`
- `apps/api/src/db/redis.ts`
- `apps/api/src/services/accountLockout.service.ts`
- `apps/api/.env.example`

### Stream C: AsyncState Type Unions

**Problem**: SWR hooks returned separate `data`/`error`/`isLoading` fields, requiring manual state derivation and lacking exhaustive type checking.

**Solution**:
1. Added `AsyncState<T>` discriminated union to `@ltip/shared` (`idle | loading | error | success`)
2. All 3 data hooks (`useBills`, `useLegislators`, `useVotes`) now return `state: AsyncState<PaginatedResponse<T>>`
3. Non-breaking: existing `data`/`error`/`isLoading` properties preserved

**Files modified** (4):
- `packages/shared/src/types/index.ts`
- `apps/web/src/hooks/useBills.ts`
- `apps/web/src/hooks/useLegislators.ts`
- `apps/web/src/hooks/useVotes.ts`

### Stream D: Performance Baseline (Deferred)

k6 scripts exist (6 files, committed in prior CR). Baselines deferred because:
1. API server has an unresolved import error (`@ltip/shared/validation` missing `validateBillId`)
2. Conflicts and Analysis endpoints return 404/placeholder responses
3. No production-like data seeded in local database

---

## Code Review Items Addressed

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| 1 | ADMIN_EMAILS workaround | MEDIUM | Database-driven UserRole enum |
| 8 | Redis maxRetriesPerRequest | MEDIUM | Configurable via env var (default: 3) |
| 9 | Lockout TTL/expiry alignment | MEDIUM | TTL matches LOCKOUT_WINDOW_SECONDS |
| 10 | Admin rate limiting | MEDIUM | 30 req/15min via express-rate-limit |
| 11 | Audit logging | MEDIUM | Structured pino logging |
| 14 | Lockout configurability | MEDIUM | 6 env vars with OWASP defaults |

**Remaining items** (deferred):
- #15 Redis pipeline optimization (LOW) — no measured bottleneck
- #18 JSDoc completeness (LOW) — no functional impact

---

## Test Results

### Before (master at 59f5be3)
- API: 925 tests
- Web: 606 tests
- Shared: 79 tests
- Total: 1610 tests

### After (feature/phase2-completion-sprint)
- API: 930 tests (+5 new)
- Web: 606 tests (unchanged)
- Shared: 79 tests (unchanged)
- Total: 1615 tests (+5 net new)

All tests passing. Build clean. TypeScript compilation clean.

---

## Commits

| Hash | Message |
|------|---------|
| `eb292da` | feat(api): implement database-driven RBAC for admin authorization |
| `6f112a2` | feat(api): make Redis connection and lockout thresholds configurable |
| `85004fe` | feat(shared,web): add AsyncState discriminated union type to data hooks |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration on existing data | LOW | MEDIUM | Default value `USER` preserves existing accounts |
| Config defaults differ from hardcoded | NONE | N/A | Defaults match exact previous hardcoded values |
| AsyncState breaks consumers | NONE | N/A | Additive — existing API preserved |

---

## Rollback Plan

Each commit is independently revertable:
1. Stream C (AsyncState): Revert `85004fe` — purely additive, no consumers depend on it yet
2. Stream B (Config): Revert `6f112a2` — env var defaults match previous hardcoded values
3. Stream A (RBAC): Revert `eb292da` + run `prisma migrate down` to remove role column
