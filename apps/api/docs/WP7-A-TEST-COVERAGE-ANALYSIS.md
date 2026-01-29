# WP7-A Historical Data Load - Test Coverage Analysis

**Document Version:** 1.0.0
**Analysis Date:** 2026-01-29
**Analyst:** ODIN (Outline Driven Intelligence)
**Status:** COMPLETE

---

## Executive Summary

Test coverage analysis for WP7-A Historical Data Load implementation reveals **MIXED** adequacy:

- **WP7-A-001 (Checkpoint Offset Reset)**: ADEQUATE with documentation test
- **WP7-A-002 (404 & Consecutive Errors)**: NEEDS_MORE_TESTS - critical scenarios missing

**Overall Assessment:** **NEEDS_MORE_TESTS**

| Fix ID | Test Coverage | Gap Severity | Recommendation |
|--------|--------------|--------------|----------------|
| WP7-A-001 | Adequate | Low | Add integration tests for completeness |
| WP7-A-002 | Insufficient | **HIGH** | Add unit tests immediately |

---

## Detailed Analysis

### WP7-A-001: Checkpoint Offset Reset

#### Implementation Summary
**Location:** `scripts/bulk-import.ts:227-245` (executePhase function)

**Fix Logic:**
```typescript
const isResumingSamePhase = state.phase === phase && state.recordsProcessed > 0;

if (isResumingSamePhase) {
  manager.update({ lastError: null });
} else {
  // Reset all progress counters when starting new phase
  manager.update({
    phase,
    lastError: null,
    offset: 0,
    recordsProcessed: 0,
    congress: null,
    billType: null,
    totalExpected: 0,
  });
}
```

#### Existing Test Coverage

**Test File:** `src/__tests__/scripts/checkpoint-manager.test.ts`

**Test 1:** `"does NOT auto-reset offset when phase changes (WP7-A-001 documentation)"` (Line 181-198)
- **Type:** Documentation Test
- **Purpose:** Documents that CheckpointManager.update() does NOT automatically reset offset
- **Coverage:** ✅ Excellent documentation of design decision
- **Gap:** Does NOT verify the actual fix in bulk-import.ts

**Test 2:** `"advancePhase > resets offset and records when advancing"` (Line 258-266)
- **Type:** Unit Test
- **Coverage:** ✅ Verifies advancePhase() resets offset/recordsProcessed
- **Gap:** advancePhase() is a different code path than executePhase()

#### Coverage Assessment: **ADEQUATE**

**Strengths:**
1. ✅ Clear documentation test explaining the design
2. ✅ Tests verify CheckpointManager behavior is correct
3. ✅ Test names clearly reference WP7-A-001

**Gaps:**
1. ❌ No integration test verifying bulk-import.ts executePhase() behavior
2. ❌ No test verifying isResumingSamePhase logic
3. ❌ No test showing phase transition resets all fields (congress, billType, totalExpected)

**Verdict:** Test documents the behavior adequately, but lacks integration verification.

---

### WP7-A-002: 404 Handling & Consecutive Errors

#### Implementation Summary
**Location:** `scripts/import-votes.ts:231-278` (listVotes function)

**Fix Logic:**
```typescript
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

try {
  response = await apiFetch<VoteListResponse>(url);
  consecutiveErrors = 0; // Reset on success
} catch (error) {
  const is404 = errorMsg.includes('404') || errorMsg.includes('Not Found');

  if (is404) {
    log('info', `End of votes data at offset ${offset} (404 - no more pages)`);
    break; // Immediate termination
  }

  consecutiveErrors++;
  log('warn', `Failed to fetch votes at offset ${offset} (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);

  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    log('error', `Stopping pagination after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
    break;
  }

  // Try next batch for transient errors
  offset += limit;
  continue;
}
```

#### Existing Test Coverage

**Test File:** `src/__tests__/ingestion/retry-handler.test.ts`

**Relevant Tests:**
1. ✅ `"retries on 429 status"` (Line 233-252)
2. ✅ `"retries on 500 status"` (Line 254-272)
3. ✅ `"does not retry on 400 status"` (Line 274-282)
4. ✅ `"throws RetryExhaustedError after max retries"` (Line 153-175)
5. ✅ Tests for isRetryableResponse (Line 68-84)
6. ✅ Tests for isRetryableError (Line 86-120)

#### Coverage Assessment: **NEEDS_MORE_TESTS**

**Critical Gaps:**

| Test Scenario | Exists? | Priority | Justification |
|--------------|---------|----------|---------------|
| 404 is treated as retryable | ❌ | **P0** | Core requirement of fix |
| 404 breaks immediately at any offset | ❌ | **P0** | Prevents wasteful API calls |
| Consecutive error counter resets on success | ❌ | **P0** | Prevents premature termination |
| Exhaustion after MAX_CONSECUTIVE_ERRORS | ❌ | **P1** | Safety mechanism |
| 3 consecutive errors still retry | ❌ | **P1** | Threshold boundary test |
| 4 consecutive errors break | ❌ | **P1** | Threshold boundary test |
| Mixed success/error pattern | ❌ | **P2** | Real-world scenario |

**Strengths:**
1. ✅ Good coverage of basic retry logic
2. ✅ Tests exponential backoff
3. ✅ Tests RetryExhaustedError
4. ✅ Tests status codes 429, 500, 400

**Gaps:**
1. ❌ **No tests for 404 status specifically**
2. ❌ **No tests for consecutive error tracking**
3. ❌ **No tests for consecutive error threshold behavior**
4. ❌ No integration tests for listVotes() function
5. ❌ No tests showing error counter reset on success

**Verdict:** Test coverage is INSUFFICIENT for WP7-A-002 fix verification.

---

## Missing Test Scenarios

### Priority 0 (Critical - Implement Immediately)

#### Test Suite: `retry-handler.test.ts`

**1. Test 404 as Retryable Status**
```typescript
describe('fetchWithRetry', () => {
  it('retries on 404 status with custom retryableStatuses', async () => {
    const notFoundResponse = { ok: false, status: 404, statusText: 'Not Found' } as Response;
    const successResponse = { ok: true, status: 200 } as Response;

    vi.mocked(fetch)
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValue(successResponse);

    const promise = fetchWithRetry('https://api.example.com', undefined, {
      maxRetries: 3,
      baseDelayMs: 100,
      useJitter: false,
      retryableStatuses: [404, 429, 500, 502, 503, 504], // Include 404
    });

    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
```

**2. Test Consecutive Error Tracking**
```typescript
describe('withRetry', () => {
  it('resets consecutive error counter on success', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))  // Error 1
      .mockResolvedValueOnce('success')                    // Success - resets counter
      .mockRejectedValueOnce(new Error('Network error'))  // Error 1 (counter was reset)
      .mockResolvedValue('success');                       // Success

    const promise = withRetry(operation, {
      maxRetries: 5,
      baseDelayMs: 10,
      useJitter: false,
    });

    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(4); // 2 errors + 2 successes
  });

  it('exhausts after consecutive error threshold', async () => {
    const error = new Error('Network error');
    const operation = vi.fn().mockRejectedValue(error);

    const promise = withRetry(operation, {
      maxRetries: 5,
      baseDelayMs: 10,
      useJitter: false,
      consecutiveErrorThreshold: 3, // New option needed
    });

    let caughtError: unknown;
    promise.catch((e) => { caughtError = e; });

    await vi.runAllTimersAsync();

    expect(caughtError).toBeInstanceOf(RetryExhaustedError);
    expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries (threshold)
  });
});
```

#### Test Suite: `import-votes.test.ts` (NEW FILE NEEDED)

**3. Integration Test for listVotes 404 Handling**
```typescript
describe('listVotes', () => {
  it('stops immediately on 404 at any offset', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createVoteListResponse(10)) // offset 0 - success
      .mockResolvedValueOnce(createVoteListResponse(10)) // offset 10 - success
      .mockRejectedValueOnce(new Error('API error: 404 Not Found')); // offset 20 - 404

    vi.mocked(apiFetch).mockImplementation(mockFetch);

    const votes = [];
    for await (const vote of listVotes(118, 'house', 1, { limit: 10, offset: 0 })) {
      votes.push(vote);
    }

    expect(votes).toHaveLength(20); // Only 2 successful batches
    expect(mockFetch).toHaveBeenCalledTimes(3); // Stopped after 404
  });

  it('stops after 3 consecutive non-404 errors', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('500 Server Error')) // Error 1
      .mockRejectedValueOnce(new Error('500 Server Error')) // Error 2
      .mockRejectedValueOnce(new Error('500 Server Error')) // Error 3
      .mockResolvedValue(createVoteListResponse(10));        // Would succeed but threshold reached

    vi.mocked(apiFetch).mockImplementation(mockFetch);

    const votes = [];
    for await (const vote of listVotes(118, 'house', 1, { limit: 10 })) {
      votes.push(vote);
    }

    expect(votes).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(3); // Exactly 3 attempts
  });

  it('continues after 2 consecutive errors if 3rd succeeds', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests')) // Error 1
      .mockRejectedValueOnce(new Error('503 Service Unavailable')) // Error 2
      .mockResolvedValueOnce(createVoteListResponse(10))          // Success - resets counter
      .mockResolvedValueOnce(createVoteListResponse(0));          // No more data

    vi.mocked(apiFetch).mockImplementation(mockFetch);

    const votes = [];
    for await (const vote of listVotes(118, 'house', 1, { limit: 10 })) {
      votes.push(vote);
    }

    expect(votes).toHaveLength(10); // Got the successful batch
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
```

### Priority 1 (High - Implement Soon)

#### Test Suite: `checkpoint-manager.test.ts`

**4. Integration Test for Phase Transition**
```typescript
describe('phase transition', () => {
  it('resets offset when starting new phase via advancePhase', () => {
    manager.create();
    manager.update({ offset: 500, recordsProcessed: 500 });

    // Advance to next phase
    const state = manager.advancePhase();

    expect(state.phase).toBe('committees');
    expect(state.offset).toBe(0);
    expect(state.recordsProcessed).toBe(0);
  });

  it('preserves offset when resuming same phase with recordsProcessed > 0', () => {
    manager.create();
    manager.update({ phase: 'legislators', offset: 500, recordsProcessed: 500 });

    // Simulate resume - update phase without changing it
    manager.update({ phase: 'legislators' });

    const state = manager.getState()!;
    expect(state.phase).toBe('legislators');
    expect(state.offset).toBe(500); // Preserved
    expect(state.recordsProcessed).toBe(500); // Preserved
  });
});
```

#### Test Suite: `bulk-import.test.ts` (NEW FILE NEEDED)

**5. Integration Test for executePhase**
```typescript
describe('executePhase', () => {
  it('resets offset when starting new phase', async () => {
    const manager = getCheckpointManager();
    manager.create();
    manager.update({
      phase: 'legislators',
      offset: 500,
      recordsProcessed: 500,
      congress: 118,
      totalExpected: 1000,
    });

    // Execute different phase
    await executePhase('committees', { dryRun: true });

    const state = manager.getState()!;
    expect(state.phase).toBe('committees');
    expect(state.offset).toBe(0);
    expect(state.recordsProcessed).toBe(0);
    expect(state.congress).toBeNull();
    expect(state.totalExpected).toBe(0);
  });

  it('preserves offset when resuming same phase', async () => {
    const manager = getCheckpointManager();
    manager.create();
    manager.update({
      phase: 'legislators',
      offset: 500,
      recordsProcessed: 500,
    });

    // Execute same phase (resume)
    await executePhase('legislators', { dryRun: true });

    const state = manager.getState()!;
    expect(state.phase).toBe('legislators');
    expect(state.offset).toBe(500); // Preserved
    expect(state.recordsProcessed).toBe(500); // Preserved
  });
});
```

### Priority 2 (Medium - Nice to Have)

**6. Edge Case Tests**
- Mixed pattern of success/error/success
- Safety limit (10000 offset) reached
- Empty response handling
- Pagination edge cases (last page has exactly `limit` items)

---

## Recommendations

### Immediate Actions (This Sprint)

1. **Add 404 Test to retry-handler.test.ts** (1 hour)
   - Test that 404 is retryable when included in retryableStatuses
   - Verify 404 does not retry when not in retryableStatuses

2. **Create import-votes.test.ts** (3 hours)
   - Add unit tests for listVotes() function
   - Test 404 immediate termination
   - Test consecutive error threshold (3 errors)
   - Test consecutive error counter reset on success

3. **Add Phase Transition Tests** (1 hour)
   - Enhance checkpoint-manager.test.ts with phase transition scenarios
   - Test offset preservation vs reset logic

### Near-Term Actions (Next Sprint)

4. **Create bulk-import.test.ts** (2-3 hours)
   - Integration tests for executePhase() function
   - Verify isResumingSamePhase logic
   - Test all field resets (offset, recordsProcessed, congress, billType, totalExpected)

5. **Refactor retry-handler.ts** (2 hours)
   - Add `consecutiveErrorThreshold` option
   - Implement consecutive error tracking in withRetry()
   - Update DEFAULT_OPTIONS

### Quality Gates

**Definition of Done for WP7-A Test Coverage:**
- [ ] All P0 tests implemented and passing
- [ ] Test coverage for retry-handler.ts ≥ 90%
- [ ] Test coverage for import-votes.ts ≥ 80%
- [ ] Integration tests verify actual fixes (not just components)
- [ ] All tests have clear names documenting what they verify
- [ ] Test documentation references WP7-A-001 and WP7-A-002

---

## Test Quality Assessment

### Current Test Quality: **GOOD**

**Strengths:**
1. ✅ Clear, descriptive test names
2. ✅ Good use of AAA pattern (Arrange-Act-Assert)
3. ✅ Proper use of fake timers in async tests
4. ✅ Tests are isolated and independent
5. ✅ Good error handling (unhandled promise rejection fix)
6. ✅ Uses mocks appropriately

**Areas for Improvement:**
1. ⚠️ Missing integration tests
2. ⚠️ Gaps in edge case coverage
3. ⚠️ Some tests test components, not the actual fix behavior

---

## Conclusion

### Overall Assessment: **NEEDS_MORE_TESTS**

**Summary:**
- WP7-A-001: Adequate documentation, but lacks integration verification
- WP7-A-002: **Critical gaps** in 404 handling and consecutive error tracking tests

**Risk Assessment:**
- **WP7-A-001 Risk:** LOW - Implementation is simple and dry-run verified
- **WP7-A-002 Risk:** MEDIUM-HIGH - Complex logic, multiple edge cases, no unit tests

**Recommendation:**
Implement Priority 0 tests immediately (404 handling and consecutive errors) before considering this work package complete. The current test suite documents design decisions well but does not adequately verify the actual bug fixes.

---

## Appendix A: Test Coverage Metrics

| Component | Lines Covered | Branch Coverage | Statement Coverage |
|-----------|--------------|-----------------|-------------------|
| checkpoint-manager.ts | High | High | ~95% |
| retry-handler.ts | Medium | Medium | ~80% |
| import-votes.ts | Low | Low | ~40% (estimated) |
| bulk-import.ts | Low | Low | ~30% (estimated) |

**Note:** Actual coverage metrics should be measured with `c8` or similar tool.

---

## Appendix B: Related Documentation

- [WP7-A GAP ANALYSIS](./WP7-A-GAP-ANALYSIS.md)
- [WP7-A-001: Checkpoint Offset Leakage](./WP7-A-GAP-ANALYSIS.md#wp7-a-001-checkpoint-offset-leakage-between-phases)
- [WP7-A-002: Votes API 404 Handling](./WP7-A-GAP-ANALYSIS.md#wp7-a-002-votes-api-404-continues-after-end-of-data)

---

**Document Status:** COMPLETE
**Review Date:** 2026-01-29
**Next Review:** After Priority 0 tests implemented
