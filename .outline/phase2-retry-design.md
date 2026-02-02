# Phase 2: Retry Logic with Exponential Backoff - Design Document

**Version**: 1.0.0
**Date**: 2026-02-02
**Author**: ODIN Code Agent
**Issue**: #19

---

## Executive Summary

Implement a reusable retry mechanism for API calls with exponential backoff, surfacing retry state to UI components for improved user experience during transient failures.

**Key Objectives**:
- Create generic `useRetry` hook with configurable retry logic
- Integrate with existing SWR-based hooks (useBills, useLegislators, useVotes)
- Expose retry state (attempt count, isRetrying) to UI components
- Maintain existing SWR functionality (dedupe, revalidation, caching)
- Zero impact on happy path performance

---

## 1. Architecture Diagram

```nomnoml
#title: Retry Logic Architecture
#direction: right

[<abstract>useRetry Hook]
[<abstract>Retry State Manager]
[<abstract>Backoff Calculator]

[UI Component] -> [useBills/useLegislators/useVotes]
[useBills/useLegislators/useVotes] -> [useRetry Hook]
[useRetry Hook] -> [Retry State Manager]
[useRetry Hook] -> [Backoff Calculator]
[useRetry Hook] -> [SWR]
[SWR] -> [API Client (fetcher)]
[API Client (fetcher)] -> [Backend API]

[Retry State Manager] -> [retryCount: number]
[Retry State Manager] -> [isRetrying: boolean]
[Retry State Manager] -> [lastError: Error | null]

[Backoff Calculator] -> [calculateDelay(attempt)]
[Backoff Calculator] -> [addJitter(delay)]

[<note>Design Principles:
1. Layered retry: Hook-level (state) + API-level (execution)
2. SWR integration: Preserve cache, dedupe, revalidation
3. Type-safe: Generic types for all data
4. Cancellation: AbortController support
5. Observability: Track attempts, expose errors]
```

**Component Interactions**:
1. **UI Component** calls data hook (useBills, etc.)
2. **Data Hook** wraps fetcher with useRetry
3. **useRetry** manages retry state and delegates to SWR
4. **SWR** calls API client fetcher (existing retry logic)
5. **API Client** executes request with exponential backoff
6. **Retry State** surfaces to UI for feedback

**Contracts**:
- `useRetry<T>`: `(fetcher: Fetcher<T>, options?) => { data, error, retryState }`
- `retryState`: `{ retryCount, isRetrying, lastError }`
- `Fetcher<T>`: `(key: string, options?: { signal?: AbortSignal }) => Promise<T>`

---

## 2. Data Flow Diagram

```nomnoml
#title: Request/Retry Data Flow
#direction: down

[User Action] -> [Component Re-render]
[Component Re-render] -> [Hook Call: useBills()]

[Hook Call: useBills()] -> [useRetry Wrapper]
[useRetry Wrapper] -> [Initialize State]
[Initialize State] -> [retryCount = 0|isRetrying = false]

[useRetry Wrapper] -> [SWR Fetch]
[SWR Fetch] -> [API Request]

[API Request] -> [<choice>Success?]
[<choice>Success?] yes -> [Return Data]
[<choice>Success?] no -> [<choice>Retryable Error?]

[<choice>Retryable Error?] yes -> [Update State: isRetrying = true|retryCount++]
[Update State: isRetrying = true|retryCount++] -> [Calculate Backoff]
[Calculate Backoff] -> [delay = 2^attempt * 1000ms + jitter]
[delay = 2^attempt * 1000ms + jitter] -> [Sleep with Cancellation]
[Sleep with Cancellation] -> [<choice>Aborted?]

[<choice>Aborted?] yes -> [Throw AbortError]
[<choice>Aborted?] no -> [<choice>Max Retries?]

[<choice>Max Retries?] yes -> [Throw Last Error]
[<choice>Max Retries?] no -> [API Request]

[<choice>Retryable Error?] no -> [Throw Error Immediately]

[Return Data] -> [Update State: retryCount = 0|isRetrying = false]
[Update State: retryCount = 0|isRetrying = false] -> [Component Render]

[Throw AbortError] -> [Component Error State]
[Throw Last Error] -> [Component Error State]
[Throw Error Immediately] -> [Component Error State]

[<note>Retryable Errors:
- NetworkError
- ApiError (status >= 500)
- ApiError (status === 429)

Non-Retryable Errors:
- ApiError (status 4xx except 429)
- ValidationError
- AbortError]
```

**Data Transformations**:
1. **User Action** → Component state change
2. **Component State** → Hook invocation with params
3. **Hook Params** → SWR cache key
4. **SWR Fetch** → API request
5. **API Response** → Typed data (Bill[], Legislator[], Vote[])
6. **Error** → Retry state update (if retryable)
7. **Retry State** → UI feedback (loading spinner, toast, etc.)

**State Transitions**:
- `idle` → `loading` (initial fetch)
- `loading` → `success` (data received)
- `loading` → `retrying` (retryable error)
- `retrying` → `loading` (after backoff delay)
- `retrying` → `error` (max retries exceeded)
- `loading` → `error` (non-retryable error)

---

## 3. Optimization Diagram

```nomnoml
#title: Exponential Backoff with Jitter
#direction: down

[Retry Attempt] -> [Calculate Base Delay]
[Calculate Base Delay] -> [baseDelay = min(1000ms * 2^attempt, 30000ms)]

[baseDelay = min(1000ms * 2^attempt, 30000ms)] -> [Add Jitter]
[Add Jitter] -> [jitter = baseDelay * 0.1 * random()]
[jitter = baseDelay * 0.1 * random()] -> [finalDelay = baseDelay + jitter]

[finalDelay = baseDelay + jitter] -> [Sleep]
[Sleep] -> [Listen for Abort Signal]
[Listen for Abort Signal] -> [<choice>Aborted?]

[<choice>Aborted?] yes -> [Clear Timeout|Reject Promise]
[<choice>Aborted?] no -> [Wait for Timeout]
[Wait for Timeout] -> [Retry Request]

[<note>Backoff Sequence (no jitter):
Attempt 0: 0ms (immediate)
Attempt 1: 1000ms (1s)
Attempt 2: 2000ms (2s)
Attempt 3: 4000ms (4s)
Attempt 4: 8000ms (8s)
Max: 30000ms (30s)

With 10% jitter:
Attempt 1: 900ms - 1100ms
Attempt 2: 1800ms - 2200ms
Attempt 3: 3600ms - 4400ms]

[<note>Performance Characteristics:
- O(1) time complexity per retry
- O(1) space complexity
- Zero heap allocations in happy path
- Cancellation prevents wasted resources
- Jitter reduces thundering herd]
```

**Optimization Strategies**:

1. **Exponential Backoff**:
   - Rapidly increasing delays prevent overwhelming backend
   - Cap at 30s prevents excessively long waits
   - Total retry time: ~15s (1s + 2s + 4s + 8s)

2. **Jitter (±10%)**:
   - Randomizes retry timing across clients
   - Prevents synchronized retry storms (thundering herd)
   - Minimal overhead: single `Math.random()` call

3. **Cancellation Support**:
   - AbortController integration
   - Cleans up pending timers on unmount
   - Prevents memory leaks
   - Zero wasted CPU cycles

4. **Happy Path Performance**:
   - Zero overhead when no errors occur
   - No additional allocations
   - No extra network requests
   - SWR cache fully utilized

5. **Complexity Analysis**:
   - Time: O(1) per retry attempt
   - Space: O(1) - only stores retry count, error
   - Network: O(n) where n = 1 + retries (max 4)

---

## 4. Memory Diagram

```nomnoml
#title: Memory Management & Lifecycle
#direction: down

[Component Mount] -> [Hook Initialization]
[Hook Initialization] -> [Allocate State]
[Allocate State] -> [retryCount: number (8 bytes)]
[Allocate State] -> [isRetrying: boolean (1 byte)]
[Allocate State] -> [lastError: Error | null (ref)]
[Allocate State] -> [abortController: AbortController (ref)]

[Hook Initialization] -> [Register Cleanup]
[Register Cleanup] -> [useEffect Cleanup Function]

[API Request] -> [Create AbortController]
[Create AbortController] -> [Pass signal to fetcher]
[Pass signal to fetcher] -> [Backend Request]

[Backend Request] -> [<choice>Success?]
[<choice>Success?] yes -> [Free Error Reference]
[<choice>Success?] no -> [<choice>Retry?]

[<choice>Retry?] yes -> [Store Error Reference]
[Store Error Reference] -> [Sleep with AbortSignal]
[Sleep with AbortSignal] -> [Backend Request]

[<choice>Retry?] no -> [Store Final Error]
[Store Final Error] -> [Component Error State]

[Component Unmount] -> [Cleanup Function Called]
[Cleanup Function Called] -> [Abort Pending Requests]
[Abort Pending Requests] -> [abortController.abort()]
[abortController.abort()] -> [Cancel Sleep Timers]
[Cancel Sleep Timers] -> [Free All References]

[Free All References] -> [GC Eligible]

[<note>Memory Safety Guarantees:
1. No memory leaks on unmount
2. All timers cleared on abort
3. Error references freed on success
4. AbortController properly disposed
5. No circular references]

[<note>Lifetime Annotations:
l(retryCount) = [mount, unmount]
l(isRetrying) = [mount, unmount]
l(lastError) = [error, success | unmount]
l(abortController) = [request, response | unmount]
l(timeout) = [sleep_start, sleep_end | abort]]
```

**Memory Safety**:

1. **Ownership**:
   - Component owns hook state
   - Hook owns AbortController
   - Cleanup function owns abort logic

2. **Lifetimes**:
   - State: Component mount → unmount
   - Error: Error occurrence → next success or unmount
   - AbortController: Request start → response or unmount
   - Timeout: Sleep start → sleep end or abort

3. **Cleanup Guarantees**:
   - All timers cleared on unmount
   - All requests aborted on unmount
   - No dangling references
   - No memory leaks

4. **Resource Management**:
   - RAII pattern: useEffect cleanup
   - Explicit abort on unmount
   - Automatic GC eligibility after cleanup

---

## 5. Concurrency Diagram

```nomnoml
#title: Concurrency & Synchronization
#direction: right

[UI Thread] -> [Component Render]
[Component Render] -> [Hook Call]
[Hook Call] -> [SWR Cache Check]

[SWR Cache Check] -> [<choice>Cache Hit?]
[<choice>Cache Hit?] yes -> [Return Cached Data]
[<choice>Cache Hit?] no -> [Async Fetch Task]

[Async Fetch Task] -> [Promise Pending]
[Promise Pending] -> [Network Request]
[Network Request] -> [<choice>Success?]

[<choice>Success?] yes -> [Resolve Promise]
[Resolve Promise] -> [Update State (Atomic)]
[Update State (Atomic)] -> [Trigger Re-render]

[<choice>Success?] no -> [Retry Logic Task]
[Retry Logic Task] -> [Update State (Atomic): isRetrying = true]
[Update State (Atomic): isRetrying = true] -> [Trigger Re-render]
[Update State (Atomic): isRetrying = true] -> [Sleep Timer Task]

[Sleep Timer Task] -> [setTimeout]
[setTimeout] -> [Timer Queue]
[Timer Queue] -> [Timer Fires]
[Timer Fires] -> [Network Request]

[Component Unmount] -> [Cleanup Task]
[Cleanup Task] -> [Abort Signal]
[Abort Signal] -> [Cancel Network Request]
[Abort Signal] -> [Clear Timers]
[Cancel Network Request] -> [Reject Promise]
[Clear Timers] -> [Reject Promise]

[<note>Synchronization:
- React state updates atomic
- No shared mutable state
- No locks required
- No race conditions

Happens-Before (→):
1. setState(isRetrying) → render
2. abortController.abort() → clearTimeout
3. unmount → cleanup → abort
4. sleep_start → timer_fire → retry

Deadlock Freedom:
- No circular dependencies
- No lock acquisition
- Promise-based coordination]

[<note>Concurrent Requests:
Each hook instance manages own:
- AbortController (independent)
- Retry state (independent)
- Timer handles (independent)

SWR handles deduplication:
- Same key = single request
- Different key = parallel requests]
```

**Concurrency Guarantees**:

1. **Thread Safety**:
   - React ensures state updates are atomic
   - No shared mutable state between components
   - Each hook instance has isolated state

2. **Happens-Before Relationships**:
   - `setState(isRetrying)` → `render()` (React guarantees)
   - `abort()` → `clearTimeout()` (synchronous)
   - `unmount` → `cleanup` → `abort()` (React lifecycle)
   - `sleep_start` → `timer_fire` → `retry` (event loop)

3. **Deadlock Freedom**:
   - No locks used
   - No circular dependencies
   - Promise-based coordination (no blocking)
   - Cleanup always completes (no infinite loops)

4. **Request Independence**:
   - Each hook instance manages own AbortController
   - Each hook instance manages own retry state
   - SWR handles deduplication (same key = single request)

---

## 6. Tidiness Diagram

```nomnoml
#title: Code Organization & Maintainability
#direction: down

[apps/web/src/hooks/]
[apps/web/src/hooks/] -> [useRetry.ts]
[apps/web/src/hooks/] -> [useBills.ts]
[apps/web/src/hooks/] -> [useLegislators.ts]
[apps/web/src/hooks/] -> [useVotes.ts]

[useRetry.ts] -> [useRetry<T> Hook]
[useRetry<T> Hook] -> [RetryOptions Interface]
[useRetry<T> Hook] -> [RetryState Interface]
[useRetry<T> Hook] -> [useRetryState Internal Hook]

[RetryOptions Interface] -> [maxRetries?: number]
[RetryOptions Interface] -> [initialDelay?: number]
[RetryOptions Interface] -> [onRetry?: (attempt) => void]

[RetryState Interface] -> [retryCount: number]
[RetryState Interface] -> [isRetrying: boolean]
[RetryState Interface] -> [lastError: Error | null]

[apps/web/src/__tests__/hooks/]
[apps/web/src/__tests__/hooks/] -> [useRetry.test.ts]
[apps/web/src/__tests__/hooks/] -> [useBills-retry.test.ts]
[apps/web/src/__tests__/hooks/] -> [useLegislators-retry.test.ts]
[apps/web/src/__tests__/hooks/] -> [useVotes-retry.test.ts]

[packages/shared/src/types/]
[packages/shared/src/types/] -> [index.ts (RetryState)]

[<note>Naming Conventions:
✅ useRetry (verb + noun)
✅ RetryState (noun)
✅ isRetrying (is + adjective)
✅ maxRetries (max + noun)
✅ calculateBackoff (verb + noun)

File Organization:
✅ Hooks in hooks/
✅ Tests mirror source structure
✅ Types in shared package
✅ No circular dependencies]

[<note>Complexity Metrics:
- Cyclomatic: <10 (target <7)
- Cognitive: <15 (target <10)
- Function lines: <50 (target <30)
- File lines: <300 (target <200)
- Dependencies: <5 (target <3)]

[<note>Readability:
✅ Self-documenting names
✅ JSDoc comments
✅ Type annotations
✅ Clear error messages
✅ Minimal nesting (<3)]
```

**Code Quality Standards**:

1. **Naming**:
   - Hooks: `use` + `Noun/Verb` (useRetry)
   - Interfaces: PascalCase (RetryState)
   - Booleans: `is/has/can` + Adjective (isRetrying)
   - Functions: verb + Noun (calculateBackoff)

2. **File Organization**:
   - Source: `apps/web/src/hooks/`
   - Tests: `apps/web/src/__tests__/hooks/`
   - Types: `packages/shared/src/types/`
   - Mirror structure in tests

3. **Complexity Targets**:
   - Cyclomatic: <7 per function
   - Cognitive: <10 per function
   - Lines: <30 per function, <200 per file
   - Dependencies: <3 per module

4. **Documentation**:
   - JSDoc for all public APIs
   - Inline comments for non-obvious logic
   - Type annotations (strict mode)
   - Examples in JSDoc

5. **YAGNI Compliance**:
   - No speculative features
   - Minimal configuration (only maxRetries, initialDelay)
   - No unnecessary abstraction layers
   - Reuse existing patterns (SWR, AbortController)

---

## Implementation Plan

### Phase 1: Core Hook (useRetry)
1. Create `useRetry.ts` with generic retry logic
2. Implement retry state management
3. Add exponential backoff with jitter
4. Integrate AbortController for cancellation
5. Write 9 core tests

### Phase 2: Integration
1. Modify `useBills.ts` to use useRetry
2. Modify `useLegislators.ts` to use useRetry
3. Modify `useVotes.ts` to use useRetry
4. Update return types to include retryState
5. Write 3 integration tests per hook

### Phase 3: Visual Verification
1. Create test page for retry simulation
2. Capture screenshot: Bills page with retry notification
3. Capture screenshot: Legislators page with retry counter
4. Capture screenshot: Votes page after successful retry

### Phase 4: Documentation
1. Create change control record
2. Update CLAUDE.md with retry patterns
3. Add JSDoc comments to all functions
4. Document retry behavior in README

---

## Risk Assessment

### Technical Risks

1. **SWR Integration Complexity** (Medium)
   - *Risk*: useRetry might conflict with SWR's built-in retry
   - *Mitigation*: Disable SWR retry (`shouldRetryOnError: false`)
   - *Fallback*: Implement custom fetcher wrapper

2. **State Synchronization** (Low)
   - *Risk*: Retry state out of sync with SWR state
   - *Mitigation*: Single source of truth (SWR state)
   - *Fallback*: useEffect to sync states

3. **Memory Leaks** (Low)
   - *Risk*: Timers not cleaned up on unmount
   - *Mitigation*: useEffect cleanup with AbortController
   - *Fallback*: Manual cleanup in catch blocks

### Performance Risks

1. **Additional Re-renders** (Low)
   - *Risk*: Retry state updates cause extra renders
   - *Mitigation*: Batch state updates, use SWR's mutate
   - *Impact*: <5% render overhead (acceptable)

2. **Network Overhead** (Low)
   - *Risk*: Retries increase total request time
   - *Mitigation*: Only retry transient errors (5xx, network)
   - *Impact*: Only on failure path (acceptable)

---

## Success Criteria

### Functional
- ✅ All 15 tests passing
- ✅ Zero TypeScript errors
- ✅ Exponential backoff correctly implemented
- ✅ Existing hooks maintain functionality
- ✅ 3 verification screenshots captured

### Quality
- ✅ Code quality ≥90% (complexity, tidiness, elegance)
- ✅ Test coverage ≥90% for new code
- ✅ Documentation complete (JSDoc, change control)
- ✅ No performance regression on happy path

### Security
- ✅ No information disclosure in retry errors
- ✅ Proper cleanup prevents resource exhaustion
- ✅ AbortController prevents runaway retries

---

## Appendix: Type Signatures

```typescript
// Core hook
export function useRetry<T>(
  fetcher: Fetcher<T>,
  options?: RetryOptions
): RetryResult<T>;

// Types
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryState {
  retryCount: number;
  isRetrying: boolean;
  lastError: Error | null;
}

export interface RetryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  retryState: RetryState;
  mutate: () => Promise<T | undefined>;
}

export type Fetcher<T> = (
  key: string,
  options?: { signal?: AbortSignal }
) => Promise<T>;
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-02
**Status**: Design Complete - Ready for Implementation
