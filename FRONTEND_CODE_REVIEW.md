# WI-Builder Frontend Code Quality Review

**Date**: 2026-01-30
**Scope**: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/`
**Files Reviewed**: 42 source files, 5 test files
**Overall Code Quality Score**: 72/100

---

## Executive Summary

The WI-Builder frontend demonstrates solid architectural foundations with proper separation of concerns, modern React patterns, and TypeScript usage. However, there are several critical issues that need immediate attention, particularly around data fetching reliability, error handling, and production code cleanliness.

**Key Strengths**:
- Well-structured directory organization following Next.js 14 App Router conventions
- Consistent use of TypeScript with proper type imports from shared package
- Clean separation between server and client components
- Proper use of SWR for data fetching with good caching strategy
- Accessible UI patterns with proper ARIA labels

**Key Concerns**:
- Low test coverage (5 tests for 42 files = ~12%)
- Cache key collision vulnerability in SWR hooks
- Console statements in production code
- Missing request cancellation and cleanup
- No API retry logic or timeout handling

---

## P0: CRITICAL ISSUES (Must Fix Before Deployment)

### 1. Cache Key Collision Risk in SWR Hooks
**Severity**: P0 (CRITICAL)
**Location**:
- `/hooks/useBills.ts:39`
- `/hooks/useLegislators.ts:40`
- `/hooks/useVotes.ts:39`

**Issue**: Using `JSON.stringify(params)` for cache keys can create collisions:
```typescript
// These create different keys for the same data:
JSON.stringify({ limit: 20, offset: 0 })
JSON.stringify({ offset: 0, limit: 20 })
```

**Impact**: Inconsistent caching, potential data duplication, cache misses leading to unnecessary API calls.

**Fix**: Use a deterministic key serialization:
```typescript
const key = enabled
  ? ['bills', Object.entries(params).sort().map(([k,v]) => `${k}:${v}`).join('|')]
  : null;
```

---

### 2. Missing API Request Cancellation
**Severity**: P0 (CRITICAL)
**Location**: `/lib/api.ts:92-132` (fetcher function)

**Issue**: No AbortController for cancelling in-flight requests when components unmount. This causes:
- Memory leaks
- Race conditions when navigating quickly
- Setting state on unmounted components

**Evidence**: Common in VotesPageClient with 30-second polling.

**Fix**: Implement AbortSignal in fetcher:
```typescript
async function fetcher<T>(endpoint: string, options?: RequestInit & { signal?: AbortSignal }) {
  // Pass signal through to fetch
}
```

---

### 3. Unsafe Polling Interval Management
**Severity**: P0 (CRITICAL)
**Location**: `/app/votes/VotesPageClient.tsx:235-242`

**Issue**: The `mutate` function is included in useEffect dependencies, which can cause interval recreation:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    mutate(); // mutate reference can change
    setLastUpdated(new Date());
  }, POLL_INTERVAL);
  return () => clearInterval(interval);
}, [mutate]); // ⚠️ mutate can change reference
```

**Impact**: Multiple simultaneous intervals, memory leaks, excessive API calls.

**Fix**: Use useCallback with stable reference or remove from deps with ESLint suppression and comment.

---

### 4. No API Error Type Discrimination
**Severity**: P0 (CRITICAL)
**Location**: `/lib/api.ts:77-86` (ApiError class)

**Issue**: All API errors treated identically. No distinction between:
- Network errors (offline, timeout)
- Client errors (400, 401, 403, 404)
- Server errors (500, 503)
- CSRF token expiration

**Impact**: Poor error recovery, confusing user messages, no retry logic for transient failures.

**Fix**: Implement error classification:
```typescript
class ApiError extends Error {
  isNetworkError: boolean;
  isClientError: boolean;
  isServerError: boolean;
  isRetryable: boolean;
  // ... classify in constructor
}
```

---

## P1: HIGH PRIORITY ISSUES (Should Fix)

### 5. Console Statements in Production Code
**Severity**: P1 (HIGH)
**Location**: Multiple error.tsx files

**Files**:
- `/app/error.tsx:20`
- `/app/global-error.tsx:18`
- `/app/bills/error.tsx:19`
- `/app/legislators/error.tsx:19`
- `/app/votes/error.tsx:19`
- `/components/common/ErrorBoundary.tsx:44`

**Issue**: 6 instances of `console.error()` that will execute in production.

**Impact**:
- Security: Exposes internal error details
- Performance: Console operations are expensive
- UX: Browser console pollution

**Fix**: Replace with proper error logging service (Sentry, LogRocket) or environment-gated logging:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
}
// Always send to logging service
logErrorToService(error, errorInfo);
```

---

### 6. Insufficient Test Coverage
**Severity**: P1 (HIGH)
**Location**: Entire codebase

**Metrics**:
- 42 source files
- 5 test files
- ~12% test coverage

**Missing Tests**:
- No tests for `useBills`, `useLegislators`, `useVotes` hooks
- No integration tests for page components
- No tests for API client error scenarios
- Only 1 test for `useDebounce`

**Impact**: High regression risk, difficult refactoring, low confidence in changes.

**Recommendation**: Aim for 70% coverage on critical paths:
- All custom hooks (useBills, useLegislators, useVotes)
- API client error handling
- Pagination logic
- Filter state management

---

### 7. Missing Input Validation in API Client
**Severity**: P1 (HIGH)
**Location**: `/lib/api.ts:148-260` (all API functions)

**Issue**: No validation of query parameters before sending to backend:
```typescript
export async function getBills(params: BillsQueryParams = {}) {
  // No validation of limit, offset, etc.
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value)); // Could be negative, NaN, etc.
    }
  }
}
```

**Impact**:
- Invalid API requests
- Backend errors for malformed input
- Security: potential for injection if not sanitized on backend

**Fix**: Add validation:
```typescript
export async function getBills(params: BillsQueryParams = {}) {
  const validated = validateBillsParams(params);
  // ... use validated
}

function validateBillsParams(params: BillsQueryParams): BillsQueryParams {
  return {
    ...params,
    limit: params.limit && params.limit > 0 && params.limit <= 100
      ? params.limit
      : undefined,
    offset: params.offset && params.offset >= 0
      ? params.offset
      : undefined,
  };
}
```

---

### 8. Hardcoded Configuration Values
**Severity**: P1 (HIGH)
**Location**: Multiple files

**Instances**:
- `PAGE_SIZE = 20` - in BillsPageClient, LegislatorsPageClient, VotesPageClient
- `POLL_INTERVAL = 30000` - in VotesPageClient
- `dedupingInterval: 5000` - in all SWR hooks
- `delay: number = 300` - in useDebounce

**Issue**: Magic numbers scattered across codebase, no central configuration.

**Impact**: Inconsistent behavior, difficult to tune performance, hard to maintain.

**Fix**: Create configuration file:
```typescript
// lib/config.ts
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const DATA_FETCHING_CONFIG = {
  DEDUPING_INTERVAL: 5000,
  DEBOUNCE_DELAY: 300,
  VOTES_POLL_INTERVAL: 30000,
} as const;
```

---

### 9. No API Retry Logic
**Severity**: P1 (HIGH)
**Location**: `/lib/api.ts:92-132` (fetcher function)

**Issue**: Single API failure causes immediate error to user. No retry for transient failures:
- Network timeouts
- 503 Service Unavailable
- 429 Rate Limiting

**Impact**: Poor UX for temporary issues, unnecessary error states.

**Fix**: Implement exponential backoff retry:
```typescript
async function fetcherWithRetry<T>(
  endpoint: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetcher<T>(endpoint, options);
    } catch (error) {
      if (i === maxRetries - 1 || !isRetryable(error)) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
}
```

---

### 10. Race Condition in Loading States
**Severity**: P1 (HIGH)
**Location**: All page client components

**Issue**: No handling for rapid filter/page changes:
```typescript
// User changes filter quickly:
// 1. Filter A request starts
// 2. Filter B request starts
// 3. Filter A completes (showing stale data)
// 4. Filter B completes
```

**Impact**: Flashing content, showing wrong data briefly.

**Fix**: SWR handles this automatically, but need to show `isValidating` state:
```typescript
{isValidating && !isLoading && (
  <div className="absolute top-2 right-2">
    <Spinner size="sm" />
  </div>
)}
```

---

## P2: MEDIUM PRIORITY ISSUES (Consider Fixing)

### 11. High Component Complexity
**Severity**: P2 (MEDIUM)
**Location**: Multiple files

**Metrics**:
- `VotesPageClient.tsx`: 417 lines
- `LegislatorsPageClient.tsx`: 324 lines
- `BillsPageClient.tsx`: 218 lines
- `BillDetailClient.tsx`: 258 lines
- `LegislatorDetailClient.tsx`: 295 lines

**Issue**: Components exceed 200-line recommended limit. High cyclomatic complexity.

**Impact**: Difficult to test, hard to reason about, poor maintainability.

**Recommendation**: Extract sub-components:
```typescript
// VotesPageClient.tsx should be split into:
// - VotesPageHeader
// - VotesFilters
// - VotesList
// - VotesPageClient (orchestrator)
```

---

### 12. Duplicated Hook Logic
**Severity**: P2 (MEDIUM)
**Location**: `/hooks/useBills.ts`, `/hooks/useLegislators.ts`, `/hooks/useVotes.ts`

**Issue**: Identical implementation pattern repeated 3 times (72 lines each):
```typescript
export function useBills(options: UseBillsOptions = {}): UseBillsResult {
  const { enabled = true, ...params } = options;
  const key = enabled ? ['bills', JSON.stringify(params)] : null;
  // ... identical pattern
}
```

**Impact**: Code duplication, maintenance burden, inconsistency risk.

**Fix**: Create generic hook:
```typescript
function usePaginatedResource<T>(
  resourceName: string,
  fetcher: (params: any) => Promise<PaginatedResponse<T>>,
  params: any = {},
  options: { enabled?: boolean } = {}
) {
  // ... shared implementation
}

export function useBills(options: UseBillsOptions = {}) {
  return usePaginatedResource('bills', getBills, options);
}
```

---

### 13. Missing Error Boundaries Around Pages
**Severity**: P2 (MEDIUM)
**Location**: All page components

**Issue**: No error boundaries wrapping page-level components. Errors in child components crash entire page.

**Current**: Error boundaries only in route-level error.tsx files.

**Impact**: Poor error isolation, entire page fails for component-level errors.

**Fix**: Wrap major sections:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <BillsPageClient />
</ErrorBoundary>
```

---

### 14. Accessibility Gaps
**Severity**: P2 (MEDIUM)
**Location**: Multiple components

**Issues**:
- Search inputs missing `aria-label` when placeholder not sufficient
- Filter selects missing `aria-describedby` for context
- Loading states not announced to screen readers
- No focus management after navigation

**Example** (`BillsPageClient.tsx:112`):
```typescript
<input
  type="search"
  placeholder="Search bills..."
  // Missing: aria-label="Search congressional bills"
  // Missing: aria-describedby="search-help"
/>
```

**Fix**: Add proper ARIA attributes and live regions.

---

### 15. No Performance Optimization
**Severity**: P2 (MEDIUM)
**Location**: Multiple components

**Missing Optimizations**:
- No `React.memo` on expensive components (BillCard, LegislatorCard, VoteCard)
- Callbacks not memoized in some cases
- List items re-render unnecessarily

**Example** (`components/bills/BillCard.tsx:18`):
```typescript
export function BillCard({ bill }: BillCardProps) {
  // Re-renders for every parent update
  // Should be: export const BillCard = React.memo(function BillCard(...) {
}
```

**Impact**: Unnecessary re-renders, slower list scrolling.

---

### 16. Inconsistent Error Messages
**Severity**: P2 (MEDIUM)
**Location**: All error handling

**Issue**: Error messages vary in format and detail:
- Some show technical details (`ApiError`)
- Some show generic messages ("Failed to load")
- No consistent tone or formatting

**Example**: Compare these:
```typescript
// BillsPageClient.tsx
<ErrorFallback error={error} title="Failed to load bills" />

// BillDetailClient.tsx
<ErrorFallback error={error} title="Failed to load bill" />
```

**Fix**: Centralize error message creation:
```typescript
function getErrorMessage(error: Error, context: string): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }
  return `Unable to ${context}. Please try again.`;
}
```

---

## P3: LOW PRIORITY ISSUES (Nice to Have)

### 17. Extractable Filter Logic
**Severity**: P3 (LOW)
**Location**: BillsPageClient, LegislatorsPageClient

**Issue**: Similar filter state management duplicated:
```typescript
const [filters, setFilters] = useState<Filters>({ ... });
const handleSearchChange = useCallback((value: string) => { ... });
const handleChamberChange = useCallback((value: Chamber) => { ... });
// ... repeated pattern
```

**Recommendation**: Extract to custom hook:
```typescript
function useFilters<T>(initialFilters: T) {
  const [filters, setFilters] = useState<T>(initialFilters);
  const updateFilter = useCallback((key: keyof T, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);
  return { filters, updateFilter, clearFilters };
}
```

---

### 18. Pagination Logic Duplication
**Severity**: P3 (LOW)
**Location**: All list page components

**Issue**: Pagination calculation repeated:
```typescript
const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 0;
const handlePageChange = useCallback((newPage: number) => {
  setPage(newPage);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}, []);
```

**Recommendation**: Extract to `usePagination` hook.

---

### 19. Inline Type Definitions
**Severity**: P3 (LOW)
**Location**: Multiple files

**Issue**: Type unions defined inline:
```typescript
type Chamber = 'house' | 'senate' | '';
type BillStatus = 'introduced' | 'in_committee' | 'passed_house' | ...;
```

**Recommendation**: Export from shared package for consistency.

---

### 20. Missing JSDoc for Utils
**Severity**: P3 (LOW)
**Location**: Component utility functions

**Issue**: Utility functions like `formatDate`, `formatBillId` lack JSDoc:
```typescript
// Missing documentation
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

**Recommendation**: Add JSDoc for better IDE experience.

---

## Code Quality Metrics

### Architecture (9/10)
- Well-organized directory structure
- Proper separation of concerns
- Clean component hierarchy
- **Minor deduction**: Some overly complex components

### Type Safety (8/10)
- Consistent TypeScript usage
- No `any` types found
- Proper imports from shared package
- **Deductions**: Missing input validation, some inline types

### Error Handling (5/10)
- Basic error boundaries present
- **Major gaps**: No error classification, no retry logic, console statements

### Performance (6/10)
- SWR caching implemented well
- **Issues**: No component memoization, potential re-render issues, cache key collision risk

### Testability (4/10)
- Clean component structure
- **Critical gap**: Only 12% test coverage

### Maintainability (7/10)
- Readable code
- **Issues**: High component complexity, code duplication in hooks

### Accessibility (7/10)
- Basic ARIA labels present
- **Gaps**: Missing live regions, incomplete ARIA attributes

### Security (7/10)
- CSRF protection implemented
- No exposed secrets
- **Concerns**: Console errors in production, missing input validation

---

## Recommended Action Plan

### Immediate (This Sprint)
1. Fix cache key collision in SWR hooks (2 hours)
2. Add request cancellation to API client (3 hours)
3. Fix polling interval race condition (1 hour)
4. Remove console statements or gate with environment check (1 hour)
5. Add API error classification (2 hours)

**Total**: ~9 hours, ~1.5 sprints

### Short Term (Next 2 Sprints)
1. Add input validation to API client (3 hours)
2. Implement retry logic (4 hours)
3. Extract configuration constants (2 hours)
4. Add tests for critical hooks (8 hours)
5. Split complex components (6 hours)

**Total**: ~23 hours, ~3 sprints

### Long Term (Next Quarter)
1. Increase test coverage to 70% (20 hours)
2. Extract shared hook logic (4 hours)
3. Add error boundaries around pages (2 hours)
4. Performance optimization pass (6 hours)
5. Accessibility audit and fixes (8 hours)

**Total**: ~40 hours, ~6 sprints

---

## Summary of Findings

**Critical Issues**: 4
**High Priority**: 6
**Medium Priority**: 6
**Low Priority**: 4

**Overall Score**: 72/100

The codebase demonstrates good architectural foundations and modern React patterns, but has critical gaps in reliability, error handling, and testing that must be addressed before production deployment. The immediate action items focus on data fetching reliability and error handling, which are essential for a robust user experience.

**Code is deployment-ready AFTER addressing P0 issues.**
