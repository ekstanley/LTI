# Change Control Record: CR-011 — Security Hardening (IP Spoofing + SWR Stability)

**Date**: 2026-02-06
**Author**: ODIN Agent
**Branch**: `feature/phase2-completion-sprint`
**PR**: #46
**Status**: Complete
**Prerequisite**: CR-010 (CI fix) complete

---

## Summary

Resolves the 2 remaining HIGH-severity issues from the Phase 2 Code Review (PHASE-2-CODE-REVIEW-2026-02-02.md), clearing the gate for PR #46 merge. Issue #2: IP spoofing vulnerability (CWE-441, CVSS 7.5) in auth rate limiter. Issue #7: SWR fetcher identity instability causing unnecessary revalidation.

---

## Root Cause Breakdown

| # | Severity | Component | Root Cause | Origin |
|---|----------|-----------|------------|--------|
| 1 | HIGH | authRateLimiter.ts | `keyGenerator` unconditionally trusts `x-forwarded-for` header, allowing attackers to bypass IP-based rate limiting | Original implementation |
| 2 | HIGH | auth.ts | `getClientMetadata()` uses `req.ip` without proxy-awareness, inconsistent with lockout middleware | Original implementation |
| 3 | HIGH | useBills/useLegislators/useVotes | `params` object spread creates new reference each render, destabilizing `useCallback` fetcher identity for SWR | CR-008 hook restructuring |

---

## Changes

### Fix 1: Extract getClientIP with TRUST_PROXY Guard (CWE-441)

**Problem**: `authRateLimiter.ts:54-60` unconditionally trusted `x-forwarded-for`, while `accountLockout.ts` had the correct `TRUST_PROXY` check pattern. `auth.ts:getClientMetadata()` used `req.ip` without any proxy awareness. Three different IP extraction strategies across the auth stack.

**Solution**: Extracted `getClientIP()` from `accountLockout.ts` to `apps/api/src/utils/ip.ts` as a shared utility. Updated all 3 call sites to use it. Added 10 unit tests covering secure defaults, proxy-trusted mode, fallback chain, and edge cases.

**Contract**: `getClientIP(req: Request): string` — secure-by-default (TRUST_PROXY=false ignores x-forwarded-for).

**Files modified** (5 + 1 test mock fix):
- `apps/api/src/utils/ip.ts` (NEW — shared utility)
- `apps/api/src/__tests__/utils/ip.test.ts` (NEW — 10 tests)
- `apps/api/src/middleware/accountLockout.ts` (removed local function, added import)
- `apps/api/src/middleware/authRateLimiter.ts` (replaced inline keyGenerator with getClientIP)
- `apps/api/src/routes/auth.ts` (replaced getClientMetadata IP logic with getClientIP)
- `apps/api/src/__tests__/middleware/authRateLimiter.test.ts` (added socket to mock for getClientIP compatibility)

### Fix 2: Stabilize SWR Fetcher Identity with useRef

**Problem**: In `useBills.ts`, `useLegislators.ts`, `useVotes.ts`, the SWR fetcher was wrapped in `useCallback` with `[params, trackRetry]` as dependencies. `params` is created via object spread (`const { enabled, ...params } = options`) each render, creating a new object reference. This caused the fetcher identity to change every render, triggering unnecessary SWR revalidation.

**Solution**: Store `params` in a `useRef` that updates synchronously on each render. Remove `params` from `useCallback` deps. The fetcher reads `paramsRef.current` at call time, ensuring it uses the latest params without changing its own identity. SWR still refetches correctly because `createStableCacheKey` changes the cache key when params change.

**Files modified** (3):
- `apps/web/src/hooks/useBills.ts`
- `apps/web/src/hooks/useLegislators.ts`
- `apps/web/src/hooks/useVotes.ts`

---

## Commits

| Hash | Message |
|------|---------|
| `cc563d2` | fix(api): extract getClientIP utility with TRUST_PROXY guard (CWE-441) |
| `2bfb05e` | fix(web): stabilize SWR fetcher identity with useRef for params |
| `d240279` | docs: add CR-011 security hardening change control record |

---

## Test Results

### API (984 tests)
- `ip.test.ts`: 10/10 pass (NEW)
- `authRateLimiter.test.ts`: 22/22 pass (1 mock updated)
- `accountLockout.test.ts`: 27/27 pass (import change only)
- All other tests: no regressions

### Web (606 tests)
- TypeCheck: 0 errors
- All 606 tests pass (hook changes are additive, no behavior change)

### Shared (84 tests)
- No changes, all pass

**Total: 1,674 tests passing**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| getClientIP extraction breaks lockout behavior | LOW | HIGH | Extracted function is byte-identical to original; 10 dedicated tests |
| TRUST_PROXY=false changes production rate limiting | NONE | N/A | Default is strictly more secure; production behind proxy sets TRUST_PROXY=true |
| useRef causes stale params in fetcher | NONE | N/A | Ref updated synchronously before render completes; SWR key triggers refetch |
| ESLint exhaustive-deps warning on useCallback | LOW | LOW | Suppressed with eslint-disable comment explaining ref pattern |

---

## Phase 2 Code Review Status Update

| Issue | Severity | Status |
|-------|----------|--------|
| #1 CRITICAL: TOCTOU in lockout check | CRITICAL | FIXED (CR-008) |
| #2 HIGH: IP spoofing (CWE-441) | HIGH | **FIXED (CR-011)** |
| #3 HIGH: AbortController memory leak | HIGH | FIXED (CR-009) |
| #4 HIGH: External signal listener leak | HIGH | FIXED (CR-009) |
| #5 HIGH: Code duplication (sleep) | HIGH | FIXED (CR-009) |
| #6 HIGH: Admin authorization bypass risk | HIGH | FIXED (CR-008) |
| #7 HIGH: SWR double-retry / fetcher instability | HIGH | **FIXED (CR-011)** |
| #8-#19 MEDIUM/LOW | MEDIUM/LOW | Deferred — do not gate merge |

**All CRITICAL and HIGH issues now resolved. PR #46 cleared for merge.**

---

## Rollback Plan

1. Revert CR-011 docs commit
2. Revert `fix(web)` — restore `[params, trackRetry]` deps in 3 hooks
3. Revert `fix(api)` — restore inline IP logic in authRateLimiter, local getClientIP in accountLockout, original getClientMetadata in auth.ts, remove ip.ts + ip.test.ts
