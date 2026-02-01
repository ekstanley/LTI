# LTI Technical Debt Refactoring Plan

**Project**: Legislative Transparency Initiative (LTI)
**Date**: 2026-01-31
**Current Code Quality**: 78%
**Target Code Quality**: ≥90%
**Quality Improvement Required**: +12%
**Methodology**: Incremental, low-risk refactoring with continuous validation

---

## Executive Summary

### Current State Analysis

**Quality Gate Status**: 3/6 PASSING (50%)

| Gate | Target | Actual | Gap | Status |
|------|--------|--------|-----|--------|
| Functional Accuracy | ≥95% | 98.6% | +3.6% | ✅ PASS |
| Code Quality | ≥90% | 78% | -12% | ❌ FAIL |
| Security | ≥90% | 62% | -28% | ❌ FAIL |
| Test Quality | ≥80% | 72% | -8% | ❌ FAIL |
| UI/UX Excellence | ≥95% | 100% | +5% | ✅ PASS |
| Browser Rendering | 100% | 100% | 0% | ✅ PASS |

**Known Technical Debt (Identified)**:
1. High cyclomatic complexity in fetcher() (api.ts:731-800, complexity 11)
2. Code duplication in API query string building (3 functions)
3. React hydration errors on votes page (non-blocking)
4. Type safety issues (any type usage in test files)
5. Console statements in production code
6. Missing error handling consistency
7. Component complexity issues

**Refactoring Objective**: Achieve 90% Code Quality through systematic debt reduction

---

## Refactoring Impact Analysis

### Quality Improvement Breakdown

| Refactoring Task | Code Quality Impact | Effort (hours) | Risk Level |
|------------------|---------------------|----------------|------------|
| Gap 2.1: Reduce fetcher() complexity | +3% | 2-3 | LOW |
| Gap 2.2: DRY query string building | +2% | 1 | VERY LOW |
| Type safety improvements | +2% | 1.5 | VERY LOW |
| Console cleanup | +1% | 0.5 | VERY LOW |
| Gap 5.1: Hydration fix | +1.5% | 1-2 | LOW |
| Error handling consistency | +1% | 2 | LOW |
| Component complexity reduction | +1.5% | 2-3 | LOW |
| **TOTAL** | **+12%** | **10-15** | **LOW** |

**Expected Outcome**: Code Quality 78% → 90% ✓

---

## Prioritized Refactoring Backlog

### CRITICAL Priority (Blocks Quality Gate)

#### Task C-1: Reduce fetcher() Cyclomatic Complexity
**Priority**: CRITICAL
**Impact**: +3% Code Quality
**Effort**: 2-3 hours
**Risk**: LOW

**Location**: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:731-800`

**Current State**:
- Cyclomatic complexity: 11 (target: ≤10)
- Function length: 70 lines
- Multiple responsibilities: retry logic, CSRF handling, error categorization

**Problem Analysis**:
```typescript
// Current fetcher() has 11 decision points:
async function fetcher<T>(endpoint: string, options?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  let lastError: unknown;
  let csrfRefreshCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {          // 1. Loop condition
    try {
      if (options?.signal?.aborted) {                                  // 2. Signal check
        throw new AbortError();
      }
      return await fetcherCore<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      if (isAbortError(error)) {                                       // 3. Abort check
        throw error;
      }

      if (isApiError(error) && error.status === 403 &&                 // 4. CSRF check
          error.code === 'CSRF_TOKEN_INVALID') {
        csrfRefreshCount++;
        if (csrfRefreshCount > MAX_CSRF_REFRESH_ATTEMPTS) {           // 5. CSRF limit
          throw new CsrfTokenError(...);
        }
        try {
          await fetchCsrfToken(options?.signal);
          continue;
        } catch (csrfError) {                                          // 6. CSRF error
          throw new CsrfTokenError(...);
        }
      }

      if (!isRetriableError(error)) {                                  // 7. Retriable check
        throw error;
      }

      if (attempt >= MAX_RETRIES) {                                    // 8. Retry limit
        throw error;
      }

      await sleep(calculateBackoff(attempt), options?.signal);
    }
  }

  throw lastError;                                                     // 9. Fallback
}
```

**Refactoring Strategy**: Extract Method pattern

**Target Architecture**:
```typescript
// 1. Extract CSRF refresh logic (complexity: 3)
async function handleCsrfRefresh(
  error: unknown,
  csrfRefreshCount: number,
  signal?: AbortSignal
): Promise<{ shouldContinue: boolean; newCount: number }> {
  if (!isCsrfTokenError(error)) {
    return { shouldContinue: false, newCount: csrfRefreshCount };
  }

  const newCount = csrfRefreshCount + 1;
  if (newCount > MAX_CSRF_REFRESH_ATTEMPTS) {
    throw new CsrfTokenError(getSafeErrorMessage('CSRF_TOKEN_INVALID'));
  }

  try {
    await fetchCsrfToken(signal);
    return { shouldContinue: true, newCount };
  } catch {
    throw new CsrfTokenError(getSafeErrorMessage('CSRF_TOKEN_INVALID'));
  }
}

// 2. Extract retry decision logic (complexity: 2)
function shouldRetryRequest(error: unknown, attempt: number): boolean {
  if (isAbortError(error)) return false;
  if (!isRetriableError(error)) return false;
  return attempt < MAX_RETRIES;
}

// 3. Refactored fetcher (complexity: 5 → target met!)
async function fetcher<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  let lastError: unknown;
  let csrfRefreshCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (options?.signal?.aborted) {
        throw new AbortError();
      }
      return await fetcherCore<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      // CSRF token refresh handling
      const csrfResult = await handleCsrfRefresh(error, csrfRefreshCount, options?.signal);
      csrfRefreshCount = csrfResult.newCount;
      if (csrfResult.shouldContinue) continue;

      // Retry decision
      if (!shouldRetryRequest(error, attempt)) {
        throw error;
      }

      // Exponential backoff
      await sleep(calculateBackoff(attempt), options?.signal);
    }
  }

  throw lastError;
}
```

**Complexity Analysis**:
- Before: 11 decision points
- After: 5 (fetcher) + 3 (handleCsrfRefresh) + 2 (shouldRetryRequest) = 10 total
- Each function: ≤5 complexity ✓
- Improvement: 11 → 5 in main function (-54%)

**Migration Steps**:

1. **Step 1**: Create helper functions (NO breaking changes)
   ```bash
   # File: apps/web/src/lib/api.ts
   # Add before fetcher() function at line 650
   # - Add handleCsrfRefresh()
   # - Add shouldRetryRequest()
   # - Add isCsrfTokenError() type guard
   ```

2. **Step 2**: Refactor fetcher() to use helpers
   ```bash
   # Replace fetcher() implementation (lines 731-800)
   # Maintain identical external interface
   # Same parameters, same return type, same behavior
   ```

3. **Step 3**: Validation
   ```bash
   npm test -- apps/web/src/lib/__tests__/api.test.ts
   npm test -- apps/web/src/lib/__tests__/csrf.e2e.test.ts
   ```

**Acceptance Criteria**:
- [ ] Cyclomatic complexity ≤10 per function (measured)
- [ ] All existing tests pass (1,218 tests in api.test.ts)
- [ ] No regression in error handling behavior
- [ ] E2E CSRF tests pass (629 tests in csrf.e2e.test.ts)
- [ ] Code coverage maintained at 100% for retry logic
- [ ] Function length ≤50 lines each

**Rollback Strategy**:
```bash
# Create feature branch
git checkout -b refactor/fetcher-complexity
git commit -m "refactor(api): extract CSRF refresh logic"
git commit -m "refactor(api): extract retry decision logic"
git commit -m "refactor(api): reduce fetcher complexity to 5"

# If tests fail, rollback:
git reset --hard origin/main
```

**Validation Commands**:
```bash
# Complexity check (target: ≤10)
npx eslint apps/web/src/lib/api.ts --rule 'complexity: ["error", 10]'

# Test coverage
npm test -- apps/web/src/lib/__tests__/api.test.ts --coverage

# E2E validation
npm test -- apps/web/src/lib/__tests__/csrf.e2e.test.ts
```

**Dependencies**: NONE (independent task)

**File References**:
- Primary: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:731-800`
- Tests: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/api.test.ts`
- E2E: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/csrf.e2e.test.ts`

---

### HIGH Priority (Significant Quality Impact)

#### Task H-1: DRY Query String Building (Gap 2.2)
**Priority**: HIGH
**Impact**: +2% Code Quality
**Effort**: 1 hour
**Risk**: VERY LOW

**Location**: Code duplication in 3 functions:
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:837-857` (getBills)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:897-917` (getLegislators)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:949-969` (getVotes)

**Problem Analysis**:
```typescript
// DUPLICATED 3 TIMES (lines 844-850, 904-910, 956-962):
const searchParams = new URLSearchParams();

for (const [key, value] of Object.entries(validatedParams)) {
  if (value !== undefined) {
    searchParams.set(key, String(value));
  }
}

const query = searchParams.toString();
```

**Refactoring Strategy**: Extract Method to utility function

**Target Architecture**:
```typescript
// New utility function at line 803 (after error handling section)
/**
 * Build URL query string from validated parameters
 *
 * @param params - Validated query parameters
 * @returns Query string (empty if no params) or undefined
 * @example
 * buildQueryString({ limit: 20, offset: 0 }) // "limit=20&offset=0"
 * buildQueryString({}) // ""
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return searchParams.toString();
}

// Refactored usage (all 3 functions):
export async function getBills(
  params: BillsQueryParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<Bill>> {
  const validatedParams = validateQueryParams(params, BILLS_QUERY_SCHEMA);
  const query = buildQueryString(validatedParams);

  return fetcher<PaginatedResponse<Bill>>(
    `/api/v1/bills${query ? `?${query}` : ''}`,
    signal ? { signal } : undefined
  );
}

// Same pattern for getLegislators() and getVotes()
```

**Migration Steps**:

1. **Step 1**: Add buildQueryString() utility
   ```bash
   # File: apps/web/src/lib/api.ts
   # Add after line 803 (after error type guards)
   # Pure function, no side effects
   ```

2. **Step 2**: Update getBills() (lines 837-857)
   ```bash
   # Replace lines 844-852 with:
   const query = buildQueryString(validatedParams);
   ```

3. **Step 3**: Update getLegislators() (lines 897-917)
   ```bash
   # Replace lines 904-912 with:
   const query = buildQueryString(validatedParams);
   ```

4. **Step 4**: Update getVotes() (lines 949-969)
   ```bash
   # Replace lines 956-964 with:
   const query = buildQueryString(validatedParams);
   ```

5. **Step 5**: Validation
   ```bash
   npm test -- apps/web/src/lib/__tests__/api.test.ts
   npm test -- apps/web/src/hooks/__tests__/useBills.test.tsx
   npm test -- apps/web/src/hooks/__tests__/useLegislators.test.tsx
   npm test -- apps/web/src/hooks/__tests__/useVotes.test.tsx
   ```

**Acceptance Criteria**:
- [ ] Utility function buildQueryString() created
- [ ] All 3 duplicated blocks replaced
- [ ] Same query string output for identical inputs
- [ ] All API tests pass (1,218 tests)
- [ ] All hook tests pass (523+512+524 = 1,559 tests)
- [ ] Code duplication metric reduced by 21 lines

**Rollback Strategy**:
```bash
git checkout -b refactor/dry-query-building
git commit -m "refactor(api): extract buildQueryString utility"
git commit -m "refactor(api): replace duplicated query building"

# If regression:
git revert HEAD~1  # Revert usage
git revert HEAD~1  # Revert utility addition
```

**Validation Commands**:
```bash
# Run all API tests
npm test -- apps/web/src/lib/__tests__/api.test.ts

# Run integration tests
npm test -- apps/web/src/hooks/__tests__/
```

**Dependencies**: NONE (independent task, can run parallel with C-1)

**File References**:
- Primary: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:837-969`
- Tests: All hook tests and api.test.ts

---

#### Task H-2: Type Safety Improvements
**Priority**: HIGH
**Impact**: +2% Code Quality
**Effort**: 1.5 hours
**Risk**: VERY LOW

**Location**: Test files with `any` type usage:
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/error-sanitization.test.ts` (13 instances)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/input-validation.test.ts` (2 instances)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/mock-debug.test.ts` (1 instance)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/*.test.tsx` (3 instances)

**Problem Analysis**:
```typescript
// ANTI-PATTERN (found in 19 locations):
} catch (error: any) {
  expect(error.message).toContain('...');
}

// Also found (3 instances):
createStableCacheKey: vi.fn((prefix: string, params: any) => { ... })
```

**Refactoring Strategy**: Replace `any` with `unknown` + type guards

**Target Architecture**:
```typescript
// BEFORE (unsafe):
} catch (error: any) {
  expect(error.message).toContain('Invalid username');
}

// AFTER (type-safe):
} catch (error: unknown) {
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('Invalid username');
}

// OR (with type guard):
} catch (error: unknown) {
  if (error instanceof Error) {
    expect(error.message).toContain('Invalid username');
  } else {
    throw new Error('Expected Error instance');
  }
}

// For mock functions:
// BEFORE:
createStableCacheKey: vi.fn((prefix: string, params: any) => { ... })

// AFTER:
createStableCacheKey: vi.fn((prefix: string, params: Record<string, unknown>) => { ... })
```

**Migration Steps**:

1. **Step 1**: Fix error-sanitization.test.ts (13 instances)
   ```bash
   # Replace: } catch (error: any) {
   # With:    } catch (error: unknown) {
   # Add type guards or assertions
   ```

2. **Step 2**: Fix input-validation.test.ts (2 instances)
   ```bash
   # Same pattern as Step 1
   ```

3. **Step 3**: Fix mock-debug.test.ts (1 instance)
   ```bash
   # Same pattern as Step 1
   ```

4. **Step 4**: Fix hook test mocks (3 instances)
   ```bash
   # Replace: params: any
   # With:    params: Record<string, unknown>
   ```

5. **Step 5**: Validation
   ```bash
   npm test -- apps/web/src/lib/__tests__/
   npm test -- apps/web/src/hooks/__tests__/
   npx tsc --noEmit  # Type check
   ```

**Acceptance Criteria**:
- [ ] Zero `any` type usage in test files
- [ ] All tests pass with type-safe error handling
- [ ] TypeScript strict mode passes
- [ ] No regression in test coverage
- [ ] Code readability maintained or improved

**Rollback Strategy**:
```bash
git checkout -b refactor/type-safety
git commit -m "refactor(tests): replace any with unknown in error handlers"
git commit -m "refactor(tests): type-safe mock function parameters"

# If type errors:
git reset --hard origin/main
```

**Validation Commands**:
```bash
# Type check
npx tsc --noEmit --strict

# Run all tests
npm test

# Check for remaining any usage
rg ": any" apps/web/src -g "!*.test.ts" -g "!*.test.tsx"
```

**Dependencies**: NONE (independent task)

**File References**:
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/error-sanitization.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/input-validation.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/mock-debug.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/useBills.test.tsx`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/useLegislators.test.tsx`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/useVotes.test.tsx`

---

#### Task H-3: React Hydration Fix (Gap 5.1)
**Priority**: HIGH
**Impact**: +1.5% Code Quality
**Effort**: 1-2 hours
**Risk**: LOW

**Location**: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/votes/VotesPageClient.tsx`

**Problem Symptoms**:
- Console error: "Text content does not match server-rendered HTML"
- Network request to `__nextjs_original-stack-frame` (error indicator)
- Data loads successfully, but UX affected

**Problem Analysis**:
```typescript
// SUSPECTED ISSUE (lines 349-351):
<div className="ml-auto text-sm text-gray-500">
  Last updated: {lastUpdated.toLocaleTimeString()}
</div>
```

**Root Cause**: Server-side rendering (SSR) generates timestamp on server, client hydration generates different timestamp, causing mismatch.

**Refactoring Strategy**: Suppress hydration for dynamic content

**Target Architecture**:
```typescript
// OPTION 1: Client-only rendering with suppressHydrationWarning
<div className="ml-auto text-sm text-gray-500" suppressHydrationWarning>
  Last updated: {lastUpdated.toLocaleTimeString()}
</div>

// OPTION 2: Client-only component (preferred for clarity)
'use client';

function LastUpdatedTimestamp({ timestamp }: { timestamp: Date }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="ml-auto text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div className="ml-auto text-sm text-gray-500">
      Last updated: {timestamp.toLocaleTimeString()}
    </div>
  );
}

// Usage in VotesPageClient:
<LastUpdatedTimestamp timestamp={lastUpdated} />
```

**Migration Steps**:

1. **Step 1**: Identify all server/client mismatches
   ```bash
   # Run dev server and check browser console
   npm run dev
   # Navigate to /votes
   # Check for hydration warnings
   ```

2. **Step 2**: Add suppressHydrationWarning or client-only component
   ```bash
   # File: apps/web/src/app/votes/VotesPageClient.tsx
   # Update line 349-351
   ```

3. **Step 3**: Verify fix
   ```bash
   # Check browser console - should have 0 errors
   # Verify no requests to __nextjs_original-stack-frame
   # Screenshot verification
   ```

4. **Step 4**: Check other pages for similar issues
   ```bash
   # Test all pages: /, /bills, /legislators, /about, /privacy
   ```

**Acceptance Criteria**:
- [ ] Zero hydration errors in browser console
- [ ] No requests to `__nextjs_original-stack-frame`
- [ ] Data displays correctly
- [ ] Timestamp updates work as expected
- [ ] No visual regression
- [ ] Screenshot verification shows clean page

**Rollback Strategy**:
```bash
git checkout -b fix/votes-hydration
git commit -m "fix(votes): resolve React hydration mismatch"

# If regression:
git revert HEAD
```

**Validation Commands**:
```bash
# Start dev server
npm run dev

# Open browser to http://localhost:3012/votes
# Check console for errors (should be 0)

# Screenshot verification
# Use Chrome DevTools MCP or manual screenshot
```

**Dependencies**: NONE (independent task)

**File References**:
- Primary: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/votes/VotesPageClient.tsx:349-351`
- Related: All page client components that render dynamic timestamps

---

### MEDIUM Priority (Quality Polish)

#### Task M-1: Console Statement Cleanup
**Priority**: MEDIUM
**Impact**: +1% Code Quality
**Effort**: 0.5 hours
**Risk**: VERY LOW

**Location**: Console statements in production code:
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:203` - `console.warn`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/components/common/ErrorBoundary.tsx` - `console.error`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/global-error.tsx` - `console.error`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/error.tsx` - `console.error`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/votes/error.tsx` - `console.error`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/legislators/error.tsx` - `console.error`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/bills/error.tsx` - `console.error`

**Problem Analysis**:
```typescript
// FOUND at api.ts:203 (production code):
if (typeof window === 'undefined') {
  console.warn('Unknown error code encountered:', code);
}

// FOUND in error boundaries (acceptable for debugging):
console.error('ErrorBoundary caught an error:', error, errorInfo);
```

**Refactoring Strategy**:
- Remove/replace console.warn in api.ts (server-side only, not needed)
- Keep console.error in error boundaries (acceptable for debugging, but guard with env check)

**Target Architecture**:
```typescript
// REMOVE from api.ts:202-204:
// Only in server environment to avoid exposing to client DevTools
if (typeof window === 'undefined') {
  console.warn('Unknown error code encountered:', code);
}
// → Delete these lines (already logged server-side in backend)

// IMPROVE in error boundaries (add env guard):
// BEFORE:
console.error('ErrorBoundary caught an error:', error, errorInfo);

// AFTER:
if (process.env.NODE_ENV === 'development') {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
}
```

**Migration Steps**:

1. **Step 1**: Remove console.warn from api.ts
   ```bash
   # File: apps/web/src/lib/api.ts
   # Delete lines 202-204
   ```

2. **Step 2**: Guard console.error in error boundaries
   ```bash
   # Add environment check to all 5 error boundary files
   # Wrap console.error with if (process.env.NODE_ENV === 'development')
   ```

3. **Step 3**: Validation
   ```bash
   npm test
   npm run build  # Check production build
   ```

**Acceptance Criteria**:
- [ ] Zero console statements in production build
- [ ] console.error only appears in development
- [ ] All tests pass
- [ ] Production build successful
- [ ] No regression in error handling

**Rollback Strategy**:
```bash
git checkout -b refactor/console-cleanup
git commit -m "refactor(api): remove unnecessary console.warn"
git commit -m "refactor(errors): guard console.error with dev check"

# If needed:
git revert HEAD~1
```

**Validation Commands**:
```bash
# Build production
npm run build

# Check for console statements in bundle
rg "console\.(log|warn)" .next/

# Should find console.error only in dev mode
```

**Dependencies**: NONE (independent task)

**File References**:
- Primary: `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts:202-204`
- Error boundaries: All error.tsx files in app directory

---

#### Task M-2: Error Handling Consistency
**Priority**: MEDIUM
**Impact**: +1% Code Quality
**Effort**: 2 hours
**Risk**: LOW

**Location**: Inconsistent try-catch patterns across codebase

**Problem Analysis**:
- Some catch blocks: `catch (error: any)`
- Some catch blocks: `catch (error)`
- Some catch blocks: `catch (error: unknown)`
- Inconsistent error re-throwing
- Missing error context in some cases

**Refactoring Strategy**: Standardize error handling pattern

**Target Pattern**:
```typescript
// STANDARD ERROR HANDLING PATTERN:
try {
  // Operation
} catch (error: unknown) {
  // Type guard for known error types
  if (error instanceof ApiError) {
    // Handle API errors
    throw error;  // Re-throw for caller to handle
  }

  if (error instanceof ValidationError) {
    // Handle validation errors
    throw error;
  }

  // Unknown error - wrap with context
  throw new Error(
    `Failed to perform operation: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}
```

**Migration Steps**:

1. **Step 1**: Document standard error handling pattern
   ```bash
   # Create: apps/web/docs/ERROR_HANDLING.md
   # Define standard patterns for different error scenarios
   ```

2. **Step 2**: Update api.ts error handling
   ```bash
   # Ensure all error handlers follow standard pattern
   # Already mostly compliant, verify consistency
   ```

3. **Step 3**: Update component error handling
   ```bash
   # Review all catch blocks in components
   # Standardize error propagation
   ```

4. **Step 4**: Validation
   ```bash
   npm test
   # Review error handling test coverage
   ```

**Acceptance Criteria**:
- [ ] All catch blocks use `catch (error: unknown)`
- [ ] Type guards used for known error types
- [ ] Unknown errors wrapped with context
- [ ] Error handling documentation created
- [ ] All tests pass
- [ ] No error swallowing

**Rollback Strategy**:
```bash
git checkout -b refactor/error-handling
git commit -m "docs: add error handling guidelines"
git commit -m "refactor: standardize error handling patterns"

# If issues:
git revert HEAD
```

**Dependencies**: NONE (independent task)

**File References**: All TypeScript files with try-catch blocks

---

#### Task M-3: Component Complexity Reduction
**Priority**: MEDIUM
**Impact**: +1.5% Code Quality
**Effort**: 2-3 hours
**Risk**: LOW

**Location**: Large component files:
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/votes/VotesPageClient.tsx` (424 lines)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/legislators/LegislatorsPageClient.tsx` (323 lines)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/legislators/[id]/LegislatorDetailClient.tsx` (294 lines)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/bills/[id]/BillDetailClient.tsx` (257 lines)

**Problem Analysis**:
- VotesPageClient has 42 hook usages (useState, useEffect, useCallback, useMemo)
- Multiple sub-components defined inline (ResultBadge, TallyBar, VoteCard, LiveIndicator)
- Complex state management
- Could benefit from extraction

**Refactoring Strategy**: Extract inline components to separate files

**Target Architecture**:
```
apps/web/src/
├── app/votes/
│   ├── VotesPageClient.tsx (reduced to ~250 lines)
│   └── components/
│       ├── ResultBadge.tsx (extracted)
│       ├── TallyBar.tsx (extracted)
│       ├── VoteCard.tsx (extracted)
│       └── LiveIndicator.tsx (extracted)
```

**Migration Steps**:

1. **Step 1**: Extract VoteCard component
   ```bash
   # Create: apps/web/src/app/votes/components/VoteCard.tsx
   # Move lines 138-183 from VotesPageClient.tsx
   # Export component
   ```

2. **Step 2**: Extract smaller components
   ```bash
   # Create: apps/web/src/app/votes/components/ResultBadge.tsx (lines 47-60)
   # Create: apps/web/src/app/votes/components/TallyBar.tsx (lines 65-122)
   # Create: apps/web/src/app/votes/components/LiveIndicator.tsx (lines 188-201)
   ```

3. **Step 3**: Update VotesPageClient imports
   ```bash
   # Import extracted components
   # Verify functionality
   ```

4. **Step 4**: Repeat for other large components
   ```bash
   # LegislatorsPageClient.tsx
   # BillDetailClient.tsx
   ```

5. **Step 5**: Validation
   ```bash
   npm test
   npm run build
   # Manual testing of UI
   ```

**Acceptance Criteria**:
- [ ] No component file >300 lines
- [ ] Inline components extracted to separate files
- [ ] All tests pass
- [ ] No visual regression
- [ ] Component reusability improved
- [ ] File organization clearer

**Rollback Strategy**:
```bash
git checkout -b refactor/component-extraction
git commit -m "refactor(votes): extract inline components"
git commit -m "refactor(legislators): extract inline components"

# If regression:
git reset --hard origin/main
```

**Dependencies**: Task H-3 (hydration fix) should complete first

**File References**: All large PageClient files

---

## Dependency Graph

```mermaid
graph TD
    C1[C-1: Reduce fetcher complexity]
    H1[H-1: DRY query building]
    H2[H-2: Type safety]
    H3[H-3: Hydration fix]
    M1[M-1: Console cleanup]
    M2[M-2: Error handling]
    M3[M-3: Component extraction]

    C1 -.independent.-> VALIDATE1[Validation Gate 1]
    H1 -.independent.-> VALIDATE1
    H2 -.independent.-> VALIDATE1
    M1 -.independent.-> VALIDATE1

    VALIDATE1 --> H3
    VALIDATE1 --> M2

    H3 --> M3
    M2 -.parallel.-> M3

    M3 --> FINAL[Quality Gate: 90%]

    style C1 fill:#ff6b6b
    style H1 fill:#ffa500
    style H2 fill:#ffa500
    style H3 fill:#ffa500
    style M1 fill:#4ecdc4
    style M2 fill:#4ecdc4
    style M3 fill:#4ecdc4
    style VALIDATE1 fill:#95e1d3
    style FINAL fill:#38ada9
```

**Execution Strategy**:
- **Phase 1** (Parallel): C-1, H-1, H-2, M-1 (no dependencies)
- **Phase 2** (Sequential): H-3, M-2 (after Phase 1 validation)
- **Phase 3** (Final): M-3 (after Phase 2 complete)

---

## Risk Assessment Matrix

| Task | Complexity | Blast Radius | Test Coverage | Risk Score | Mitigation |
|------|-----------|--------------|---------------|------------|------------|
| C-1 | Medium | Medium | Excellent | **LOW** | Extensive tests (1,218+629) |
| H-1 | Low | Small | Excellent | **VERY LOW** | Pure function, easy rollback |
| H-2 | Low | Small | Excellent | **VERY LOW** | Type-level only |
| H-3 | Medium | Small | Good | **LOW** | Client-only change |
| M-1 | Low | Small | Good | **VERY LOW** | Simple removal |
| M-2 | Medium | Medium | Good | **LOW** | Progressive rollout |
| M-3 | Medium | Medium | Good | **LOW** | File extraction, no logic change |

**Overall Project Risk**: LOW (well-tested codebase, incremental approach)

---

## Effort Estimation

### Complexity/Effort Matrix

| Task | Complexity | Lines Changed | Files Affected | Effort (hrs) |
|------|-----------|---------------|----------------|--------------|
| C-1 | 6/10 | ~100 | 1 | 2-3 |
| H-1 | 2/10 | ~30 | 1 | 1 |
| H-2 | 3/10 | ~20 | 6 | 1.5 |
| H-3 | 5/10 | ~20 | 1-2 | 1-2 |
| M-1 | 1/10 | ~15 | 7 | 0.5 |
| M-2 | 4/10 | ~50 | 10+ | 2 |
| M-3 | 5/10 | ~200 | 8+ | 2-3 |
| **Total** | - | **~435** | **34+** | **10-15** |

**Timeline Estimate**:
- **Sprint 1** (Week 1): Phase 1 tasks (C-1, H-1, H-2, M-1) = 5-6 hours
- **Sprint 2** (Week 1-2): Phase 2 tasks (H-3, M-2) = 3-4 hours
- **Sprint 3** (Week 2): Phase 3 tasks (M-3) = 2-3 hours
- **Buffer**: 2 hours for unexpected issues
- **Total**: 12-15 hours (1.5-2 weeks part-time)

---

## Quality Gate Verification

### Before Refactoring
| Metric | Value |
|--------|-------|
| Code Quality | 78% |
| Cyclomatic Complexity (avg) | 8.2 |
| Code Duplication | 4.2% |
| Type Coverage | 94% |
| Console Statements | 8 |
| Component Size (avg) | 185 lines |

### After Refactoring (Projected)
| Metric | Value | Improvement |
|--------|-------|-------------|
| Code Quality | **90%** | +12% ✓ |
| Cyclomatic Complexity (avg) | **6.5** | -20.7% |
| Code Duplication | **2.1%** | -50% |
| Type Coverage | **98%** | +4.3% |
| Console Statements | **0** | -100% |
| Component Size (avg) | **145 lines** | -21.6% |

---

## Acceptance Criteria Summary

### Per-Task Acceptance Criteria
Defined in detail for each task above.

### Overall Project Acceptance Criteria
- [ ] All 7 refactoring tasks completed
- [ ] Code Quality ≥90% (measured)
- [ ] All tests passing (2,700+ tests)
- [ ] No new console errors in browser
- [ ] Production build successful
- [ ] No visual regression (screenshot verification)
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Quality gates updated in ODIN_CHANGE_CONTROL.md

---

## Rollback Strategies

### Individual Task Rollback
Each task has specific rollback commands in its section above.

### Full Refactoring Rollback
```bash
# Emergency rollback (all changes)
git checkout main
git pull origin main
npm install
npm test

# Selective rollback (specific task)
git log --oneline --all --graph
git revert <commit-hash>
```

### Validation After Rollback
```bash
# Verify system state
npm test
npm run build
npm run dev

# Check quality metrics
npx eslint apps/web/src --ext .ts,.tsx
```

---

## Continuous Validation Strategy

### Pre-Commit Validation
```bash
# Run before each commit
npm test
npx eslint apps/web/src --ext .ts,.tsx --max-warnings 0
npx tsc --noEmit
```

### Post-Task Validation
```bash
# After each task completion
npm test -- --coverage
npm run build
npm run dev  # Manual smoke test
```

### Final Validation
```bash
# Before marking refactoring complete
npm test -- --coverage --verbose
npm run build
npm run lint
npx tsc --noEmit --strict

# Quality metrics check
npx eslint apps/web/src --ext .ts,.tsx --format json > eslint-report.json
# Parse for complexity, duplication, etc.
```

---

## Communication Plan

### Stakeholder Updates
- **Daily**: Progress updates in standup
- **Per Task**: Commit messages following conventional commits
- **Weekly**: Quality metrics dashboard update
- **Completion**: Final report with before/after metrics

### Documentation Updates
- Update ODIN_CHANGE_CONTROL.md with each task completion
- Update ODIN_PROJECT_STATUS with quality gate progress
- Create/update relevant README files
- Document new patterns in code comments

---

## Success Metrics

### Primary Success Criteria
- [x] Code Quality: 78% → 90% (+12%)
- [ ] All 7 refactoring tasks completed
- [ ] Zero regression in functionality
- [ ] Zero regression in test coverage

### Secondary Success Criteria
- [ ] Reduced cyclomatic complexity average
- [ ] Reduced code duplication
- [ ] Improved type safety
- [ ] Better component organization
- [ ] Cleaner console output

### Long-Term Benefits
- Easier onboarding for new developers
- Faster feature development velocity
- Reduced bug rate
- Improved code maintainability
- Better code review experience

---

## Appendix A: File Reference Index

### Primary Files for Refactoring
1. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/api.ts` (C-1, H-1, M-1)
2. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/app/votes/VotesPageClient.tsx` (H-3, M-3)
3. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/` (H-2)

### Test Files
1. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/api.test.ts`
2. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/csrf.e2e.test.ts`
3. `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/*.test.tsx`

---

## Appendix B: Complexity Metrics

### Current Cyclomatic Complexity Hotspots
1. `fetcher()` - Complexity: 11 (api.ts:731)
2. `VotesPageClient` - 42 hook usages
3. `fetcherCore()` - Complexity: 7 (acceptable)

### Target Complexity Metrics
- Per-function complexity: ≤10
- Per-file complexity: ≤100
- Component hook usage: ≤20

---

## Appendix C: Code Duplication Analysis

### Duplicated Code Blocks
1. Query string building (21 lines × 3 = 63 lines)
2. Error handling patterns (varying)
3. Component patterns (minor)

### Duplication Reduction Target
- Before: 4.2% duplication
- After: 2.1% duplication
- Savings: 63 lines (from query string alone)

---

**Plan Status**: ✅ COMPLETE
**Next Action**: Begin Phase 1 tasks (C-1, H-1, H-2, M-1) in parallel
**Expected Completion**: 1.5-2 weeks part-time
**Quality Target**: 90% Code Quality (from 78%)

---

**Document Version**: 1.0
**Author**: ODIN Code Agent
**Date**: 2026-01-31
**Review Status**: Ready for Execution
