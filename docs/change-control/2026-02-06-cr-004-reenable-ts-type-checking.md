# Change Record: CR-2026-02-06-004

**Change ID**: CR-2026-02-06-004
**Date**: 2026-02-06
**Category**: Category 2 (Standard Changes - Team Approval)
**Status**: Completed
**Related Issue**: #29 (Re-enable TypeScript type-checking rules)
**Related PR**: TBD (fix/issue-29-reenable-ts-type-checking)

---

## Summary

Re-enabled 6 `@typescript-eslint` type-checking rules that were disabled in PR #28 (CR-002). Fixed all underlying type violations in production code across 9 files. This restores compile-time type safety enforcement that prevents unsafe `any` usage from propagating through the codebase.

---

## Problem Statement

PR #28 disabled 6 type-checking rules to unblock CI:
- `no-unsafe-argument`
- `no-unsafe-assignment`
- `no-unsafe-call`
- `no-unsafe-member-access`
- `no-unsafe-return`
- `no-redundant-type-constituents`

These rules were originally estimated at 680+ violations requiring 4 weeks of remediation. Investigation revealed the actual scope was 31 production violations across 6 files.

---

## Root Cause Analysis

**Primary cause**: `parserOptions.project` was missing from both ESLint configs. Without it, type-aware rules were silently non-functional -- they could be set to `"error"` but would never fire because ESLint lacked TypeScript type information.

**Secondary causes**:
1. Express `req.cookies` and `req.body` are typed as `any` in `@types/express`
2. Prisma event callbacks lacked explicit type annotations (Prisma 6.x provides typed event interfaces)
3. Next.js `next/dist/compiled/web-vitals` ships no `.d.ts` file, making `useReportWebVitals` callback parameter resolve to `any`
4. Admin middleware used explicit `any` parameters instead of Express types
5. Validation middleware used dynamic `req[location]` indexing that returned `any`

---

## Changes

### Configuration (2 files)

| File | Change |
|------|--------|
| `apps/api/.eslintrc.json` | Added `parserOptions.project`, changed 6 rules from `"off"` to `"error"` |
| `apps/web/.eslintrc.json` | Added `parserOptions.project`, changed 6 rules from `"off"` to `"error"` |

### Production Code Fixes (9 files)

| File | Violations Fixed | Approach |
|------|-----------------|----------|
| `apps/api/src/db/client.ts` | 13 | Used `Prisma.QueryEvent` / `Prisma.LogEvent` typed event interfaces |
| `apps/web/src/components/analytics/WebVitals.tsx` | 8 | Created `next-web-vitals.d.ts` module declaration to bridge types |
| `apps/api/src/routes/auth.ts` | 4 | Added `getCookie()` typed accessor for `req.cookies` |
| `apps/api/src/routes/admin.ts` | 3 | Replaced `any` params with `Request`, `Response`, `NextFunction` |
| `apps/api/src/middleware/validate.ts` | 2 | Added `getRequestData()` / `setRequestData()` switch helpers |
| `apps/api/src/db/redis.ts` | 1 | Changed return type from `Promise<any>` to `Promise<unknown>` |
| `apps/api/src/middleware/accountLockout.ts` | 1 | Narrowed `req.body` type via explicit cast |
| `apps/api/src/services/accountLockout.service.ts` | 0 | Updated method references after `eval` -> `runLuaScript` rename |
| `apps/web/src/types/next-web-vitals.d.ts` | N/A | New file: module declaration for compiled web-vitals types |

### Inline Disables

| Before | After | Justification |
|--------|-------|---------------|
| 27 | 3 | Reduced by 89% |

Remaining 3 inline disables:
1. `validate.ts` (2x): Express types `req.query` as `ParsedQs` and `req.params` as `ParamsDictionary`. Zod-validated output is structurally compatible but TypeScript cannot verify the assignment.
2. `client.ts` (1x): `no-var` required for `declare global` augmentation (unrelated to this sprint).

---

## Verification

| Gate | Result |
|------|--------|
| `pnpm lint` | 0 errors, 17 pre-existing warnings |
| `pnpm typecheck` | Zero errors |
| `pnpm build` | All 3 packages pass |
| `pnpm test` | Shared: 79/79, Web: 424/424, API: 571/574 (3 pre-existing flaky) |

The 3 API test failures are pre-existing Redis isolation issues between concurrent test files. All 3 pass when run in isolation. They are unrelated to this change.

---

## Risk Assessment

| Risk | Assessed | Actual |
|------|----------|--------|
| Hidden violations from `parserOptions.project` | LOW | 7 additional violations (fixed) |
| Prisma types unresolvable | MEDIUM | Prisma 6.x provides full typed events |
| Test regressions | LOW | Zero regressions |
| CI slowdown from type-aware linting | MEDIUM | Not yet measured in CI |

---

## Branch Cleanup

Deleted stale merged branches (local + remote):
- `feature/issue-8-api-client-tests`
- `feature/quick-wins-sprint-20-18-6`
- `feature/security-reliability-sprint`
- `fix/ci-lint-errors`
- `fix/h2-csrf-dos-vulnerability`
- `fix/issue-39-flaky-retry-tests`
- `hotfix/p0-critical-security-issues-2-3`

---

## Rollback Plan

Revert the single commit on `fix/issue-29-reenable-ts-type-checking` branch. All changes are contained in one atomic commit. No database migrations, no runtime behavior changes.
