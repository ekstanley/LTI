# Change Control Record: CR-013 — Production Hardening Sprint

**Date**: 2026-02-07
**Author**: ODIN Agent
**Branch**: `feature/cr-013-production-hardening`
**Status**: Complete
**Prerequisite**: CR-012 (visual verification) complete; PR #46 merged to master

---

## Summary

Closes 4 remaining quality gaps identified by post-merge codebase audit: API test coverage parity, IP format validation, persistent audit logging, and stale documentation. Produces 17 new tests and 1 new service.

---

## Changes

### WI-1: API Test Coverage Gate

**Problem**: `apps/api/vitest.config.ts` had no coverage thresholds. `apps/web/vitest.config.ts` enforced 80% — parity gap.

**Solution**: Added `thresholds` block (lines/functions/branches/statements at 80%) to API vitest config.

**Files modified** (1):
- `apps/api/vitest.config.ts` (added thresholds block)

### WI-2: IP Address Validation

**Problem**: `getClientIP()` returned raw strings without format validation. Malformed IPs could propagate to Redis keys (CWE-77 risk).

**Solution**: Added `validateIP()` helper using Node.js `net.isIP()`. All return paths in `getClientIP()` now validate through `net.isIP()`. Invalid IPs return `'unknown'` (maintains existing contract).

**Files modified** (2):
- `apps/api/src/utils/ip.ts` (added `import { isIP }` + `validateIP()` helper)
- `apps/api/src/__tests__/utils/ip.test.ts` (10 new tests: IPv4, IPv6, malformed, injection)

### WI-3: Persistent Audit Logging

**Problem**: Auth events (login, token refresh, lockout, admin actions) logged to console only. Lost on container restart.

**Solution**: Added `AuditAction` enum + `AuditLog` Prisma model. Created `logAuditEvent()` service with fire-and-forget pattern (never throws, falls back to `console.error`). Integrated into auth routes, admin routes, and lockout middleware.

**Files created** (2):
- `apps/api/src/services/audit.service.ts` (fire-and-forget logAuditEvent)
- `apps/api/src/__tests__/services/audit.service.test.ts` (7 tests)

**Files modified** (4):
- `apps/api/prisma/schema.prisma` (AuditAction enum + AuditLog model + User relation)
- `apps/api/src/routes/auth.ts` (audit events on login success/failure + token refresh)
- `apps/api/src/routes/admin.ts` (audit event on unlock-account)
- `apps/api/src/middleware/accountLockout.ts` (audit event on account lockout)

### WI-4: Documentation Update

**Files modified** (1):
- `CLAUDE.md` (updated security status, added audit logging patterns, updated test counts)

**Files created** (1):
- `docs/change-control/2026-02-07-cr-013-production-hardening.md` (this document)

---

## Commits

| Hash | Message |
|------|---------|
| `ed3388f` | fix(api): add 80% coverage thresholds to vitest config |
| `328fd19` | fix(api): validate IP format with net.isIP() before return |
| `355ca3b` | feat(api): add persistent audit logging with AuditLog model |
| TBD | docs: update CLAUDE.md and add CR-013 change control record |

---

## Test Results

### API (1,001 tests — 44 files)
- `ip.test.ts`: 20/20 pass (10 new validation tests)
- `audit.service.test.ts`: 7/7 pass (NEW)
- All other tests: no regressions

### Web (606 tests — 39 files)
- No changes, all pass

### Shared (84 tests — 4 files)
- No changes, all pass

**Total: 1,691 tests passing** (up from 1,625 in CR-012)

---

## Quality Gates

| Check | Result |
|-------|--------|
| `pnpm test` | 1,691/1,691 pass |
| `pnpm build` | Clean |
| `pnpm typecheck` | 0 errors |
| Coverage thresholds (API) | 80% enforced |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| IP validation rejects valid edge-case IPs | LOW | LOW | `net.isIP()` is battle-tested Node.js stdlib; 10 test cases |
| Audit logging degrades auth latency | LOW | MEDIUM | Fire-and-forget pattern; `void` prefix, no await in critical path |
| Prisma migration conflicts | LOW | MEDIUM | Schema append-only; no existing model modifications |
| Coverage threshold blocks CI | LOW | BLOCKING | Verified API coverage exceeds 80% before adding threshold |

---

## Rollback Plan

1. Revert CR-013 docs commits
2. Revert `feat(api)` — remove audit.service.ts, audit.service.test.ts, revert schema, routes, middleware
3. Revert `fix(api): validate IP` — restore ip.ts and ip.test.ts to pre-validation state
4. Revert `fix(api): add coverage` — remove thresholds from vitest.config.ts
