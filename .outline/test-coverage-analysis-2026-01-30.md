# Frontend Test Coverage Analysis Report

**Date**: 2026-01-30
**Scope**: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/`
**Current Coverage**: 12.74% (Statements)

---

## Executive Summary

### Current State
- **Total Source Files**: 40 TypeScript/TSX files
- **Test Files**: 5 test files
- **Tests Passing**: 87 tests (100% pass rate)
- **Lines of Code**: ~5,258 lines

### Coverage Metrics
| Metric      | Current | Target | Gap    |
|-------------|---------|--------|--------|
| Statements  | 12.74%  | 80%    | -67.26%|
| Branches    | 10.22%  | 80%    | -69.78%|
| Functions   | 9.63%   | 80%    | -70.37%|
| Lines       | 13.33%  | 80%    | -66.67%|

---

## Completed Test Coverage ✅

### 1. useCsrf Hook
**File**: `src/hooks/useCsrf.ts`
**Test File**: `src/hooks/__tests__/useCsrf.test.ts`
**Coverage**: 100% (15 unit tests)
**Status**: ✅ Complete

### 2. API CSRF Integration
**File**: `src/lib/api.ts` (CSRF functions only)
**Test File**: `src/lib/__tests__/csrf.e2e.test.ts`
**Coverage**: 100% for CSRF (19 e2e tests)
**Status**: ✅ Complete

### 3. Badge Component
**File**: `src/components/ui/Badge.tsx`
**Test File**: `src/components/ui/Badge.test.tsx`
**Coverage**: 100% (19 tests)
**Status**: ✅ Complete

### 4. Pagination Component
**File**: `src/components/common/Pagination.tsx`
**Test File**: `src/components/common/Pagination.test.tsx`
**Coverage**: 89.47% statements, 100% functions (25 tests)
**Status**: ✅ Complete (minor gaps in edge case branches)

### 5. Utils Library
**File**: `src/lib/utils.ts`
**Test File**: `src/lib/utils.test.ts`
**Coverage**: 100% (15 tests)
**Status**: ✅ Complete

---

## Critical Gaps: P0 Priority 🔴

### 1. Custom Hooks (0% Coverage)

#### useBills Hook
**File**: `apps/web/src/hooks/useBills.ts`
**Current Coverage**: 0%
**Complexity**: Medium
**Risk**: High (critical data fetching)

**Required Tests** (12 tests):
1. `useBills()` - Basic fetching
   - Should fetch bills with default params
   - Should return empty array initially
   - Should handle loading state
   - Should handle error state
   - Should respect enabled flag
   - Should build correct cache key
   - Should handle pagination params

2. `useBills()` - SWR Configuration
   - Should disable revalidateOnFocus
   - Should use 5000ms deduping interval
   - Should trigger mutate on demand

3. `useBill()` - Single bill fetching
   - Should fetch single bill by ID
   - Should return null when no ID provided
   - Should handle error fetching single bill

**Test File Path**: `apps/web/src/hooks/__tests__/useBills.test.ts`
**Estimated Effort**: 4-6 hours

---

#### useLegislators Hook
**File**: `apps/web/src/hooks/useLegislators.ts`
**Current Coverage**: 0%
**Complexity**: Medium
**Risk**: High (critical data fetching)

**Required Tests** (12 tests):
1. `useLegislators()` - Basic fetching
   - Should fetch legislators with default params
   - Should return empty array initially
   - Should handle loading state
   - Should handle error state
   - Should respect enabled flag
   - Should build correct cache key
   - Should handle filter params (chamber, party, state)

2. `useLegislators()` - SWR Configuration
   - Should disable revalidateOnFocus
   - Should use 5000ms deduping interval
   - Should trigger mutate on demand

3. `useLegislator()` - Single legislator fetching
   - Should fetch single legislator by ID
   - Should return null when no ID provided
   - Should handle error fetching single legislator

**Test File Path**: `apps/web/src/hooks/__tests__/useLegislators.test.ts`
**Estimated Effort**: 4-6 hours

---

#### useVotes Hook
**File**: `apps/web/src/hooks/useVotes.ts`
**Current Coverage**: 0%
**Complexity**: Medium
**Risk**: High (critical data fetching)

**Required Tests** (12 tests):
1. `useVotes()` - Basic fetching
   - Should fetch votes with default params
   - Should return empty array initially
   - Should handle loading state
   - Should handle error state
   - Should respect enabled flag
   - Should build correct cache key
   - Should handle filter params (chamber, billId, result)

2. `useVotes()` - SWR Configuration
   - Should disable revalidateOnFocus
   - Should use 5000ms deduping interval
   - Should trigger mutate on demand

3. `useVote()` - Single vote fetching
   - Should fetch single vote by ID
   - Should return null when no ID provided
   - Should handle error fetching single vote

**Test File Path**: `apps/web/src/hooks/__tests__/useVotes.test.ts`
**Estimated Effort**: 4-6 hours

---

#### useDebounce Hook
**File**: `apps/web/src/hooks/useDebounce.ts`
**Current Coverage**: 0%
**Complexity**: Low
**Risk**: Medium (utility hook, used in search)

**Required Tests** (6 tests):
1. Basic Functionality
   - Should return initial value immediately
   - Should debounce value changes
   - Should use custom delay
   - Should use default 300ms delay

2. Edge Cases
   - Should handle rapid value changes
   - Should cleanup timeout on unmount

**Test File Path**: `apps/web/src/hooks/__tests__/useDebounce.test.ts`
**Estimated Effort**: 2-3 hours

---

### 2. API Client (23.72% Coverage)

**File**: `apps/web/src/lib/api.ts`
**Current Coverage**: 23.72% (CSRF functions covered, rest at 0%)
**Complexity**: High
**Risk**: Critical (all data fetching flows through here)

**Required Tests** (50 tests):

#### Bills API (10 tests)
- getBills()
  - Should fetch bills with query params
  - Should handle empty results
  - Should build correct query string
  - Should handle congressNumber filter
  - Should handle billType filter
  - Should handle status filter
  - Should handle search param
  - Should handle pagination (limit, offset)

- getBill()
  - Should fetch single bill by ID
  - Should handle 404 error

#### Legislators API (8 tests)
- getLegislators()
  - Should fetch legislators with filters
  - Should handle chamber filter
  - Should handle party filter
  - Should handle state filter
  - Should handle search param
  - Should handle pagination

- getLegislator()
  - Should fetch single legislator by ID
  - Should handle 404 error

#### Votes API (8 tests)
- getVotes()
  - Should fetch votes with filters
  - Should handle chamber filter
  - Should handle billId filter
  - Should handle result filter
  - Should handle pagination

- getVote()
  - Should fetch single vote by ID
  - Should handle 404 error

- getBillAnalysis()
  - Should fetch bill analysis by billId

#### Conflicts API (6 tests)
- getConflicts()
  - Should fetch conflicts by legislator ID
  - Should return array from data property
  - Should handle empty results

- getBillConflicts()
  - Should fetch conflicts by bill ID
  - Should return array from data property
  - Should handle empty results

#### HTTP Client - fetcher() (12 tests)
- Request Handling
  - Should include credentials in all requests
  - Should set Content-Type to application/json
  - Should merge custom headers
  - Should construct full URL from endpoint
  - Should default to GET method

- CSRF Token Handling
  - Should add CSRF token header for POST
  - Should add CSRF token header for PUT
  - Should add CSRF token header for PATCH
  - Should add CSRF token header for DELETE
  - Should not add CSRF token for GET
  - Should store new CSRF token from response header

- Error Handling
  - Should throw ApiError with status and code
  - Should handle JSON parse error in error response
  - Should provide default error message
  - Should expose status, code, and message

#### Health Check (2 tests)
- checkHealth()
  - Should fetch health status
  - Should return status object

**Test File Path**: `apps/web/src/lib/__tests__/api.test.ts`
**Estimated Effort**: 12-16 hours

---

## High Priority Gaps: P1 🟠

### 1. Page Components (0% Coverage)

#### BillsPageClient
**File**: `apps/web/src/app/bills/BillsPageClient.tsx`
**Current Coverage**: 0%
**Complexity**: High (178 lines)
**Risk**: High (critical user flow)

**Required Tests** (15 tests):
1. Rendering
   - Should render bills list page
   - Should display page title and description
   - Should render search input
   - Should render filter controls
   - Should show loading state initially

2. Data Fetching
   - Should fetch bills on mount
   - Should display fetched bills
   - Should handle empty results
   - Should handle fetch error

3. Search Functionality
   - Should update search on input change
   - Should debounce search input
   - Should trigger fetch with search term

4. Filtering
   - Should filter by congress number
   - Should filter by bill type
   - Should filter by status

5. Pagination
   - Should handle page change
   - Should maintain filters across pages

**Test File Path**: `apps/web/src/app/bills/__tests__/BillsPageClient.test.tsx`
**Estimated Effort**: 6-8 hours

---

#### LegislatorsPageClient
**File**: `apps/web/src/app/legislators/LegislatorsPageClient.tsx`
**Current Coverage**: 0%
**Complexity**: High (277 lines)
**Risk**: High (critical user flow)

**Required Tests** (15 tests):
1. Rendering
   - Should render legislators list page
   - Should display page title
   - Should render search input
   - Should render filter controls
   - Should show loading state initially

2. Data Fetching
   - Should fetch legislators on mount
   - Should display fetched legislators
   - Should handle empty results
   - Should handle fetch error

3. Search Functionality
   - Should update search on input change
   - Should debounce search input
   - Should trigger fetch with search term

4. Filtering
   - Should filter by chamber
   - Should filter by party
   - Should filter by state

5. Pagination
   - Should handle page change
   - Should maintain filters across pages

**Test File Path**: `apps/web/src/app/legislators/__tests__/LegislatorsPageClient.test.tsx`
**Estimated Effort**: 6-8 hours

---

#### VotesPageClient
**File**: `apps/web/src/app/votes/VotesPageClient.tsx`
**Current Coverage**: 0%
**Complexity**: Very High (359 lines)
**Risk**: High (critical user flow)

**Required Tests** (18 tests):
1. Rendering
   - Should render votes list page
   - Should display page title
   - Should render filter controls
   - Should show loading state initially
   - Should display vote cards

2. Data Fetching
   - Should fetch votes on mount
   - Should display fetched votes
   - Should handle empty results
   - Should handle fetch error
   - Should auto-refresh every 30 seconds

3. Filtering
   - Should filter by chamber
   - Should filter by bill ID
   - Should filter by result
   - Should combine multiple filters

4. Real-time Updates
   - Should show last updated time
   - Should trigger manual refresh
   - Should cleanup interval on unmount

5. Pagination
   - Should handle page change
   - Should maintain filters across pages

**Test File Path**: `apps/web/src/app/votes/__tests__/VotesPageClient.test.tsx`
**Estimated Effort**: 8-10 hours

---

#### BillDetailClient
**File**: `apps/web/src/app/bills/[id]/BillDetailClient.tsx`
**Current Coverage**: 0%
**Complexity**: High (194 lines)
**Risk**: High (critical user flow)

**Required Tests** (12 tests):
1. Rendering
   - Should render bill detail page
   - Should show loading state initially
   - Should display bill information
   - Should display sponsor information
   - Should show cosponsors
   - Should show latest actions

2. Data Fetching
   - Should fetch bill by ID on mount
   - Should handle fetch error
   - Should handle bill not found

3. Navigation
   - Should link to sponsor detail
   - Should link back to bills list

4. Edge Cases
   - Should handle bill without sponsor
   - Should handle bill without cosponsors
   - Should handle bill without actions

**Test File Path**: `apps/web/src/app/bills/[id]/__tests__/BillDetailClient.test.tsx`
**Estimated Effort**: 5-6 hours

---

#### LegislatorDetailClient
**File**: `apps/web/src/app/legislators/[id]/LegislatorDetailClient.tsx`
**Current Coverage**: 0%
**Complexity**: Medium (95 lines)
**Risk**: Medium

**Required Tests** (10 tests):
1. Rendering
   - Should render legislator detail page
   - Should show loading state
   - Should display legislator information
   - Should show contact information

2. Data Fetching
   - Should fetch legislator by ID
   - Should handle fetch error
   - Should handle legislator not found

3. Navigation
   - Should link to bills list
   - Should link back to legislators list

4. Edge Cases
   - Should handle missing optional fields

**Test File Path**: `apps/web/src/app/legislators/[id]/__tests__/LegislatorDetailClient.test.tsx`
**Estimated Effort**: 4-5 hours

---

### 2. Bill Components (0% Coverage)

#### BillCard
**File**: `apps/web/src/components/bills/BillCard.tsx`
**Current Coverage**: 0%
**Complexity**: Low (103 lines)
**Risk**: Medium (used in list views)

**Required Tests** (12 tests):
1. Rendering
   - Should render bill card
   - Should display bill ID
   - Should display bill title
   - Should display status badge
   - Should display sponsor information
   - Should display latest action
   - Should display cosponsor count
   - Should display policy area
   - Should display introduced date

2. Status Badge Variants
   - Should use success variant for became_law
   - Should use error variant for vetoed
   - Should use error variant for failed
   - Should use warning variant for in_committee
   - Should use default variant for other statuses

3. Navigation
   - Should link to bill detail page
   - Should generate correct bill slug

4. Edge Cases
   - Should handle missing sponsor
   - Should handle missing short title
   - Should handle missing latest action
   - Should handle missing policy area
   - Should handle singular/plural cosponsors

**Test File Path**: `apps/web/src/components/bills/__tests__/BillCard.test.tsx`
**Estimated Effort**: 3-4 hours

---

#### BiasSpectrum
**File**: `apps/web/src/components/bills/BiasSpectrum.tsx`
**Current Coverage**: 0%
**Complexity**: Low (74 lines)
**Risk**: Low (visualization component)

**Required Tests** (10 tests):
1. Rendering
   - Should render bias spectrum
   - Should display bias label
   - Should display confidence percentage
   - Should render gradient bar
   - Should render position indicator

2. Label Display
   - Should hide label when showLabel is false
   - Should show label when showLabel is true

3. Position Calculation
   - Should position indicator at left for score -1
   - Should position indicator at center for score 0
   - Should position indicator at right for score 1
   - Should calculate position correctly for score -0.5
   - Should calculate position correctly for score 0.5

4. Size Variants
   - Should apply small size styles
   - Should apply medium size styles
   - Should apply large size styles

5. Confidence Display
   - Should display confidence as percentage
   - Should round confidence to nearest integer

**Test File Path**: `apps/web/src/components/bills/__tests__/BiasSpectrum.test.tsx`
**Estimated Effort**: 2-3 hours

---

## Medium Priority Gaps: P2 🟡

### 1. Common Components (0-29% Coverage)

#### ErrorBoundary
**File**: `apps/web/src/components/common/ErrorBoundary.tsx`
**Current Coverage**: 0%
**Complexity**: Medium (class component)
**Risk**: Medium (error handling)

**Required Tests** (8 tests):
1. Error Catching
   - Should catch errors from children
   - Should render fallback UI on error
   - Should call onError callback
   - Should log error to console

2. Custom Fallback
   - Should render custom fallback when provided

3. Error Recovery
   - Should reset error state on retry
   - Should re-render children after retry

4. ErrorFallback Component
   - Should display error message
   - Should display custom title
   - Should render retry button
   - Should call onRetry when button clicked

**Test File Path**: `apps/web/src/components/common/__tests__/ErrorBoundary.test.tsx`
**Estimated Effort**: 3-4 hours

---

#### LoadingState
**File**: `apps/web/src/components/common/LoadingState.tsx`
**Current Coverage**: 0%
**Complexity**: Low (114 lines)
**Risk**: Low (UI component)

**Required Tests** (10 tests):
1. Rendering
   - Should render loading state
   - Should display loading message
   - Should render spinner variant
   - Should render dots variant

2. Size Variants
   - Should apply small size
   - Should apply medium size
   - Should apply large size

3. Full Page Mode
   - Should apply full page height
   - Should use regular padding when not full page

4. LoadingInline Component
   - Should render inline spinner
   - Should apply custom className

5. Accessibility
   - Should have role="status"
   - Should have aria-label

**Test File Path**: `apps/web/src/components/common/__tests__/LoadingState.test.tsx`
**Estimated Effort**: 2-3 hours

---

#### EmptyState
**File**: `apps/web/src/components/common/EmptyState.tsx`
**Current Coverage**: 0%
**Complexity**: Low (100 lines)
**Risk**: Low (UI component)

**Required Tests** (12 tests):
1. Default Variant
   - Should render default empty state
   - Should display default title
   - Should display default message
   - Should use default icon

2. Search Variant
   - Should render search variant
   - Should display search-specific message

3. Filter Variant
   - Should render filter variant
   - Should display filter-specific message

4. Error Variant
   - Should render error variant
   - Should display error message

5. Custom Content
   - Should display custom title
   - Should display custom message
   - Should use custom icon
   - Should render action button

6. CSS
   - Should apply custom className

**Test File Path**: `apps/web/src/components/common/__tests__/EmptyState.test.tsx`
**Estimated Effort**: 2-3 hours

---

#### Navigation
**File**: `apps/web/src/components/common/Navigation.tsx`
**Current Coverage**: 0%
**Complexity**: Medium (127 lines)
**Risk**: Medium (critical navigation)

**Required Tests** (12 tests):
1. Rendering
   - Should render navigation header
   - Should display logo
   - Should render desktop navigation links
   - Should render mobile menu button

2. Active Link Highlighting
   - Should highlight active Bills link
   - Should highlight active Legislators link
   - Should highlight active Votes link
   - Should highlight active link on subpages

3. Mobile Menu
   - Should toggle mobile menu on button click
   - Should close mobile menu when link clicked
   - Should show close icon when menu open
   - Should show menu icon when menu closed

4. Navigation Links
   - Should link to /bills
   - Should link to /legislators
   - Should link to /votes

**Test File Path**: `apps/web/src/components/common/__tests__/Navigation.test.tsx`
**Estimated Effort**: 3-4 hours

---

### 2. UI Components (18% Coverage)

#### Card
**File**: `apps/web/src/components/ui/Card.tsx`
**Current Coverage**: 0%
**Complexity**: Low (compound component)
**Risk**: Low (wrapper component)

**Required Tests** (6 tests):
1. Card Component
   - Should render card with children
   - Should apply custom className
   - Should forward ref

2. CardHeader Component
   - Should render card header
   - Should apply custom className

3. CardContent Component
   - Should render card content
   - Should apply custom className

4. CardFooter Component
   - Should render card footer
   - Should apply custom className

**Test File Path**: `apps/web/src/components/ui/__tests__/Card.test.tsx`
**Estimated Effort**: 1-2 hours

---

#### Skeleton
**File**: `apps/web/src/components/ui/Skeleton.tsx`
**Current Coverage**: 0%
**Complexity**: Low (22 lines)
**Risk**: Low (loading placeholder)

**Required Tests** (4 tests):
1. Rendering
   - Should render skeleton
   - Should apply custom className
   - Should apply animation

2. Variants
   - Should support different sizes
   - Should support rounded variants

**Test File Path**: `apps/web/src/components/ui/__tests__/Skeleton.test.tsx`
**Estimated Effort**: 1 hour

---

## Low Priority Gaps: P3 ⚪

### 1. Error Pages (0% Coverage)

#### App-level Error Pages
**Files**:
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/global-error.tsx`
- `apps/web/src/app/bills/error.tsx`
- `apps/web/src/app/legislators/error.tsx`
- `apps/web/src/app/votes/error.tsx`

**Current Coverage**: 0%
**Complexity**: Very Low (error handlers)
**Risk**: Low (rarely executed)

**Required Tests** (10 tests total, 2 per file):
1. Should render error UI
2. Should display error message
3. Should provide reset/retry action

**Test File Paths**:
- `apps/web/src/app/__tests__/error.test.tsx`
- `apps/web/src/app/__tests__/global-error.test.tsx`
- `apps/web/src/app/bills/__tests__/error.test.tsx`
- `apps/web/src/app/legislators/__tests__/error.test.tsx`
- `apps/web/src/app/votes/__tests__/error.test.tsx`

**Estimated Effort**: 2-3 hours total

---

### 2. Static Pages (0% Coverage)

#### Home Page
**File**: `apps/web/src/app/page.tsx`
**Coverage**: 0%
**Complexity**: Low (static content)
**Risk**: Very Low

**Required Tests** (5 tests):
1. Should render home page
2. Should display hero section
3. Should show feature cards
4. Should have navigation links
5. Should have call-to-action buttons

**Test File Path**: `apps/web/src/app/__tests__/page.test.tsx`
**Estimated Effort**: 1-2 hours

---

#### About Page
**File**: `apps/web/src/app/about/page.tsx`
**Coverage**: 0%
**Complexity**: Very Low (static content)
**Risk**: Very Low

**Required Tests** (2 tests):
1. Should render about page
2. Should display about content

**Test File Path**: `apps/web/src/app/about/__tests__/page.test.tsx`
**Estimated Effort**: 30 minutes

---

#### Privacy Page
**File**: `apps/web/src/app/privacy/page.tsx`
**Coverage**: 0%
**Complexity**: Very Low (static content)
**Risk**: Very Low

**Required Tests** (2 tests):
1. Should render privacy page
2. Should display privacy content

**Test File Path**: `apps/web/src/app/privacy/__tests__/page.test.tsx`
**Estimated Effort**: 30 minutes

---

### 3. Index Files (0% Coverage)

**Files**:
- `apps/web/src/components/ui/index.ts`
- `apps/web/src/components/common/index.ts`
- `apps/web/src/components/bills/index.ts`
- `apps/web/src/hooks/index.ts`

**Coverage**: 0%
**Risk**: Very Low (re-exports only)
**Note**: Index files typically don't require testing as they only re-export other modules.

---

## Integration vs Unit Tests

### Current Distribution
- **Unit Tests**: 68 tests (78%)
  - Badge: 19 tests
  - Pagination: 25 tests
  - useCsrf: 15 tests
  - Utils: 15 tests

- **E2E/Integration Tests**: 19 tests (22%)
  - CSRF API integration: 19 tests

### Recommended Additions

#### Integration Test Suites Needed (P1)

1. **Bills Flow Integration** (8 tests)
   - Test complete bills list → detail → back flow
   - Test search and filter persistence
   - Test pagination across real API
   - Test error recovery flows

2. **Legislators Flow Integration** (8 tests)
   - Test complete legislators list → detail → back flow
   - Test filtering by chamber/party/state
   - Test pagination across real API
   - Test error recovery flows

3. **Votes Flow Integration** (8 tests)
   - Test real-time vote updates
   - Test filtering and pagination
   - Test auto-refresh behavior
   - Test error recovery flows

**Test File Paths**:
- `apps/web/src/__tests__/integration/bills-flow.test.tsx`
- `apps/web/src/__tests__/integration/legislators-flow.test.tsx`
- `apps/web/src/__tests__/integration/votes-flow.test.tsx`

**Estimated Effort**: 6-8 hours per suite

---

## Test Execution Commands

### Run All Tests
```bash
cd /Users/estanley/Documents/GitHub/LTI/apps/web
npm test
```

### Run Specific Test File
```bash
npm test src/hooks/__tests__/useBills.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### View Coverage Report
```bash
open coverage/index.html
```

### Run Tests with Specific Pattern
```bash
npm test -- --testNamePattern="useBills"
```

---

## Implementation Priority Matrix

| Priority | Component Type | Effort | Risk | Count | Total Hours |
|----------|---------------|--------|------|-------|-------------|
| **P0**   | Hooks + API   | High   | Critical | 5 items | 34-44 hours |
| **P1**   | Page Components | High | High | 7 items | 40-51 hours |
| **P2**   | UI Components | Medium | Medium | 6 items | 15-21 hours |
| **P3**   | Static/Error Pages | Low | Low | 8 items | 4-6 hours |
| **Integration** | E2E Flows | High | High | 3 suites | 18-24 hours |

**Total Estimated Effort**: 111-146 hours

---

## Recommended Execution Plan

### Phase 1: Critical Infrastructure (Week 1-2)
**Goal**: Establish solid foundation for data fetching
- [ ] useBills hook tests (12 tests)
- [ ] useLegislators hook tests (12 tests)
- [ ] useVotes hook tests (12 tests)
- [ ] useDebounce hook tests (6 tests)
- [ ] API client tests (50 tests)

**Deliverable**: 92 new tests, ~30% coverage increase
**Effort**: 34-44 hours

### Phase 2: User Flows (Week 3-4)
**Goal**: Cover critical user-facing functionality
- [ ] BillsPageClient tests (15 tests)
- [ ] LegislatorsPageClient tests (15 tests)
- [ ] VotesPageClient tests (18 tests)
- [ ] BillDetailClient tests (12 tests)
- [ ] LegislatorDetailClient tests (10 tests)
- [ ] BillCard tests (12 tests)
- [ ] BiasSpectrum tests (10 tests)

**Deliverable**: 92 new tests, ~40% coverage increase
**Effort**: 40-51 hours

### Phase 3: UI Components (Week 5)
**Goal**: Complete component library testing
- [ ] ErrorBoundary tests (8 tests)
- [ ] LoadingState tests (10 tests)
- [ ] EmptyState tests (12 tests)
- [ ] Navigation tests (12 tests)
- [ ] Card tests (6 tests)
- [ ] Skeleton tests (4 tests)

**Deliverable**: 52 new tests, ~15% coverage increase
**Effort**: 15-21 hours

### Phase 4: Integration Tests (Week 6)
**Goal**: Validate end-to-end flows
- [ ] Bills flow integration (8 tests)
- [ ] Legislators flow integration (8 tests)
- [ ] Votes flow integration (8 tests)

**Deliverable**: 24 new tests, integration coverage
**Effort**: 18-24 hours

### Phase 5: Polish & Static (Week 7)
**Goal**: Achieve 80% coverage target
- [ ] Error page tests (10 tests)
- [ ] Home page tests (5 tests)
- [ ] About page tests (2 tests)
- [ ] Privacy page tests (2 tests)
- [ ] Fix Pagination edge cases (reach 100%)

**Deliverable**: 19 new tests, 80%+ coverage achieved
**Effort**: 4-6 hours

---

## Coverage Targets by Phase

| Phase | New Tests | Cumulative Tests | Estimated Coverage |
|-------|-----------|------------------|-------------------|
| Current | 87 | 87 | 12.74% |
| Phase 1 | 92 | 179 | ~43% |
| Phase 2 | 92 | 271 | ~70% |
| Phase 3 | 52 | 323 | ~78% |
| Phase 4 | 24 | 347 | ~80% |
| Phase 5 | 19 | 366 | ~82% |

---

## Test Template Examples

### Hook Test Template
```typescript
/**
 * Tests for useBills hook
 * @module hooks/__tests__/useBills
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBills, useBill } from '../useBills';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

describe('useBills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic fetching', () => {
    it('should fetch bills with default params', async () => {
      const mockData = {
        data: [{ id: '1', title: 'Test Bill' }],
        pagination: { total: 1, page: 1, limit: 20 },
      };

      vi.mocked(api.getBills).mockResolvedValue(mockData);

      const { result } = renderHook(() => useBills());

      await waitFor(() => {
        expect(result.current.bills).toEqual(mockData.data);
        expect(result.current.isLoading).toBe(false);
      });
    });

    // Additional tests...
  });
});
```

### Component Test Template
```typescript
/**
 * Tests for BillCard component
 * @module components/bills/__tests__/BillCard
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillCard } from '../BillCard';
import type { Bill } from '@ltip/shared';

describe('BillCard', () => {
  const mockBill: Bill = {
    id: '1',
    billType: 'hr',
    billNumber: 1,
    congressNumber: 119,
    title: 'Test Bill',
    status: 'in_committee',
    sponsor: {
      id: 'S001',
      fullName: 'John Doe',
      party: 'D',
      state: 'CA',
    },
    cosponsorsCount: 5,
    introducedDate: '2024-01-01',
  };

  it('should render bill card', () => {
    render(<BillCard bill={mockBill} />);
    expect(screen.getByText('Test Bill')).toBeInTheDocument();
  });

  // Additional tests...
});
```

---

## Known Issues

### Act Warnings in useCsrf Tests
**Issue**: React state updates not wrapped in act()
**Impact**: Test warnings (tests still pass)
**Fix**: Wrap async state updates in `act()` or use `waitFor()`
**Priority**: P2 (cleanup task)

---

## Metrics Tracking

### Coverage Goals
- **Week 2**: 40% coverage (Phase 1 complete)
- **Week 4**: 70% coverage (Phase 2 complete)
- **Week 6**: 80% coverage (Phase 4 complete)
- **Week 7**: 82%+ coverage (Phase 5 complete)

### Quality Gates
- All tests must pass before merging
- No regressions in existing coverage
- 80% minimum branch coverage for new code
- All critical paths (P0) must have 100% coverage

---

## Additional Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### Test Configuration
- Config File: `/Users/estanley/Documents/GitHub/LTI/apps/web/vitest.config.ts`
- Setup File: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/test-setup.ts`
- Coverage Reports: `/Users/estanley/Documents/GitHub/LTI/apps/web/coverage/`

---

## Summary Statistics

### Test Files to Create: 24 new test files

### Total Tests to Write: 279 new tests
- P0 Priority: 92 tests
- P1 Priority: 92 tests
- P2 Priority: 52 tests
- P3 Priority: 19 tests
- Integration: 24 tests

### Total Effort: 111-146 hours
- P0 Priority: 34-44 hours
- P1 Priority: 40-51 hours
- P2 Priority: 15-21 hours
- P3 Priority: 4-6 hours
- Integration: 18-24 hours

### Expected Outcome
- **Current Coverage**: 12.74%
- **Target Coverage**: 82%
- **Improvement**: +69.26 percentage points
- **Test Count**: 87 → 366 tests (+279 tests, 321% increase)

---

**Report Generated**: 2026-01-30
**Next Review**: After Phase 1 completion
**Contact**: Development Team
