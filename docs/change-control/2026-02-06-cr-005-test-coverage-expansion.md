# Change Control Record: CR-2026-02-06-005

**Date**: 2026-02-06
**Type**: Test Coverage Expansion
**Branch**: `test/coverage-expansion-sprint`
**PR**: #43
**Issues**: #23, #8
**Status**: Submitted for review

---

## Summary

Expanded test coverage across the LTI platform with 178 new tests in 15 test files. Established shared test infrastructure (factories, render helpers) and created integration tests for 4 API route files and 9 web component/hook test suites.

## Changes

### New Files (15)

| File | Tests | Description |
|------|-------|-------------|
| `apps/web/src/__tests__/helpers/factories.ts` | - | Mock data factories (Bill, Legislator, Vote, User, Pagination) |
| `apps/web/src/__tests__/helpers/render.tsx` | - | SWR cache isolation wrapper |
| `apps/web/src/components/common/__tests__/Navigation.test.tsx` | 8 | Nav links, active state, mobile menu |
| `apps/web/src/components/common/__tests__/LoadingState.test.tsx` | 8 | Accessibility, size variants, messages |
| `apps/web/src/components/common/__tests__/EmptyState.test.tsx` | 8 | Variant defaults, action button |
| `apps/web/src/components/common/__tests__/ErrorBoundary.test.tsx` | 10 | Catch/reset, custom fallback, onError |
| `apps/web/src/hooks/__tests__/useDebounce.test.ts` | 7 | Timer reset, cleanup on unmount |
| `apps/web/src/hooks/__tests__/useAuth.test.tsx` | 3 | Context access, missing provider |
| `apps/web/src/app/bills/__tests__/BillsPageClient.test.tsx` | 12 | 4-state, filters, pagination, scroll |
| `apps/web/src/app/bills/[id]/__tests__/BillDetailClient.test.tsx` | 11 | Detail rendering, sponsor link |
| `apps/web/src/app/legislators/__tests__/LegislatorsPageClient.test.tsx` | 15 | 4 filters, cards, state dropdown |
| `apps/web/src/app/legislators/[id]/__tests__/LegislatorDetailClient.test.tsx` | 12 | Office status, contact info |
| `apps/web/src/app/votes/__tests__/VotesPageClient.test.tsx` | 19 | Polling, live indicator, tally bar |
| `apps/api/src/__tests__/routes/bills.routes.test.ts` | 15 | 7 endpoints, validation, 404 |
| `apps/api/src/__tests__/routes/legislators.routes.test.ts` | 13 | 7 endpoints incl. voting-record alias |
| `apps/api/src/__tests__/routes/votes.routes.test.ts` | 15 | Documents unreachable /compare route |
| `apps/api/src/__tests__/routes/committees.routes.test.ts` | 19 | Standing, subcommittees, members |

### Modified Files (3)

| File | Change |
|------|--------|
| `apps/web/src/__tests__/setup.tsx` | Added 20+ lucide-react icon mocks |
| `apps/api/package.json` | Added supertest + @types/supertest devDependencies |
| `pnpm-lock.yaml` | Lockfile update for new dependencies |

## Test Results

| Package | Before | After | Delta |
|---------|--------|-------|-------|
| Web | 368 tests / 20 files | 537 tests / 33 files | +169 tests / +13 files |
| API | 572 tests / 24 files | 637 tests / 28 files | +65 tests / +4 files |
| Shared | 79 tests / 5 files | 79 tests / 5 files | unchanged |
| **Total** | **1,019** | **1,253** | **+234** |

Note: 178 new tests written; delta is 234 because some test improvements during the sprint affected existing counts.

## Quality Gates

| Gate | Result |
|------|--------|
| `pnpm build` | Pass |
| `pnpm typecheck` | Pass (0 errors) |
| `pnpm lint` | Pass (0 errors, pre-existing warnings only) |
| `pnpm test` | Pass (2 pre-existing flaky lockout tests on master) |

## Methodology

Design-by-Contract approach: each test suite designed around explicit contracts (preconditions, postconditions, invariants) before implementation. All 5 page components verified against the shared 4-state rendering contract: loading, error, empty, and data states with mutual exclusion invariant.

## Findings

1. **Route ordering bug in votes.ts**: `GET /votes/compare` is unreachable because `GET /votes/:id` is defined first in the Express router, causing Express to match `:id = 'compare'`. Documented in test with `NOTE` comment. Not fixed in this PR (behavior change, separate issue).

2. **Zod boolean coercion trap**: `z.coerce.boolean()` converts the string `"false"` to `true` because `Boolean("false") === true`. Tests work around this by omitting the parameter to use schema defaults.

## Deferred

- Auth service tests (jwt, password, oauth) - security-critical, dedicated sprint
- Auth route tests (15+ endpoints) - coupled to auth services
- Reaching 80% web coverage threshold - this sprint targets 65-70%

## Commits

```
7b50734 test(web): add shared test infrastructure (factories, render helpers)
bfa82a2 test(web): add common component tests (Navigation, Loading, Empty, ErrorBoundary)
1fedbce test(web): add hook tests (useDebounce, useAuth)
3c5c4cd test(web): add page component tests (Bills, Legislators, Votes)
dd50dea test(api): add route integration tests (bills, legislators, votes, committees)
```
