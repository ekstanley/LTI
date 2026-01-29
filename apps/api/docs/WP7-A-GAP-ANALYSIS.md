# WP7-A Historical Data Load - Gap Analysis

**Document Version:** 2.0.0
**Analysis Date:** 2026-01-29
**Methodology:** ODIN (Outline Driven Intelligence)
**Status:** IN PROGRESS - QC PHASE

---

## Executive Summary

This gap analysis identifies issues discovered during verification of the WP7-A Historical Data Load implementation. Version 2.0.0 incorporates comprehensive QC analysis using parallel agent review methodology.

### Issue Summary by Category

| Category | Critical (P0) | High (P1) | Medium (P2) | Low (P3) | Total |
|----------|---------------|-----------|-------------|----------|-------|
| Bugs (Original) | 2 ✅ | 1 ✅ | 1 | 0 | 4 |
| Code Quality | 3 | 8 | 13 | 8 | 32 |
| Test Coverage | 7 | 6 | 6 | 3 | 22 |
| Silent Failures | 4 | 8 | 10 | 5 | 27 |
| Architecture | 0 | 7 | 10 | 6 | 23 |
| **Total** | **16** | **30** | **40** | **22** | **108** |

✅ = Resolved in v1.x

### Production Readiness Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| TypeScript Compilation | PASS | 0 errors |
| Unit Tests | PASS | 343 tests, 0 failures |
| Dry-Run Pipeline | PASS | All 5 phases complete |
| Test Coverage | FAIL | Import scripts have 0% coverage |
| Error Handling | FAIL | Silent failures risk data loss |
| Production Hardening | FAIL | Missing circuit breaker, transactions |

**Recommendation:** NOT READY for production deployment. Address P0 issues before proceeding.

---

## Phase 1: Original Issues (v1.x) - RESOLVED

### WP7-A-001: Checkpoint Offset Leakage Between Phases

**Priority:** P0 (Critical) | **Effort:** S | **Status:** ✅ RESOLVED (2026-01-29)

#### Description
When transitioning between import phases, the checkpoint offset from the previous phase leaks into the new phase, causing the new phase to start at an invalid offset position.

#### Resolution
Fix applied to `scripts/bulk-import.ts:227-245`. Added conditional logic to detect whether resuming same phase or starting new phase, with explicit reset of progress counters.

---

### WP7-A-002: Votes API 404 Continues After End of Data

**Priority:** P1 (High) | **Effort:** S | **Status:** ✅ RESOLVED (2026-01-29)

#### Description
When the votes API returns 404 (indicating no more data), the import continues incrementing offset instead of stopping.

#### Resolution
Fix applied to `scripts/import-votes.ts:231-278`. Added consecutive error tracking and improved 404 detection.

---

### WP7-A-003: Unhandled Promise Rejection in Test

**Priority:** P2 (Medium) | **Effort:** XS | **Status:** ✅ RESOLVED

#### Description
Test caused unhandled promise rejection warning due to timer advancement before assertion handler attachment.

#### Resolution
Fixed in `src/__tests__/ingestion/retry-handler.test.ts`. Attached catch handler before advancing timers.

---

### WP7-A-004: Missing Senate Vote Import Strategy

**Priority:** P2 (Medium) | **Effort:** L | **Status:** DOCUMENTED LIMITATION

#### Description
Congress.gov API only provides House vote endpoints. Senate roll call votes require senate.gov scraping.

#### Acceptance Criteria
1. [x] Document limitation in user-facing documentation
2. [ ] Add warning during import if Senate votes expected
3. [ ] (Future) Evaluate senate.gov scraping as separate work package

---

### WP7-A-005: Data Loss on Transient Errors

**Priority:** P0 (Critical) | **Effort:** XS | **Status:** ✅ RESOLVED (2026-01-29)

#### Description
Transient errors (429, 500) after retry exhaustion advanced offset, permanently skipping data batches.

#### Resolution
Fix applied to `scripts/import-votes.ts:262-275`. Now retries same offset until MAX_CONSECUTIVE_ERRORS reached.

---

## Phase 2: Code Quality Issues (QC Analysis)

### QC-001: Infinite Loop Risk in Error Handling

**Priority:** P0 (Critical) | **Effort:** S (1-2 hours) | **Status:** OPEN

#### Description
The consecutive error handling in `import-votes.ts` could theoretically loop indefinitely if the break condition is never met due to error counter never reaching threshold.

#### Location
`scripts/import-votes.ts:263-275`

```typescript
consecutiveErrors++;
if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
  log('error', `Stopping after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
  break;
}
continue; // Could loop indefinitely if errors keep occurring but counter resets
```

#### Root Cause
If a single successful fetch occurs between errors, `consecutiveErrors` resets to 0, allowing infinite retries at the same offset pattern.

#### Acceptance Criteria
1. Add maximum total error count (not just consecutive)
2. Add maximum retry duration timeout
3. Log total errors attempted in final summary
4. Unit test verifies termination within bounded time

#### Testable Deliverables
- [ ] Unit test: `listVotes terminates after MAX_TOTAL_ERRORS regardless of pattern`
- [ ] Unit test: `listVotes terminates after MAX_DURATION timeout`
- [ ] Integration test: Verify bounded execution time

#### Dependencies
None - standalone fix

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fix causes premature termination | Medium | High | Add generous thresholds (100 total, 1hr timeout) |
| Timeout not honored during API call | Low | Medium | Use AbortController |

---

### QC-002: No Runtime Validation of Checkpoint State

**Priority:** P0 (Critical) | **Effort:** M (2-4 hours) | **Status:** OPEN

#### Description
Checkpoint state is loaded from JSON with type assertion but no runtime validation. Corrupted or tampered checkpoint files could crash the import or cause data corruption.

#### Location
`scripts/checkpoint-manager.ts:175-202`

```typescript
const data = fs.readFileSync(this.checkpointPath, 'utf-8');
this.state = JSON.parse(data) as CheckpointState; // No validation!
```

#### Acceptance Criteria
1. Add Zod schema for CheckpointState validation
2. Validate on load, reject malformed checkpoints
3. Log validation errors with specific field failures
4. Graceful fallback to backup or fresh start

#### Testable Deliverables
- [ ] Unit test: `load rejects checkpoint with missing required fields`
- [ ] Unit test: `load rejects checkpoint with invalid field types`
- [ ] Unit test: `load falls back to backup when main is invalid`
- [ ] Unit test: `load creates fresh checkpoint when both invalid`

#### Dependencies
- Add `zod` to dev dependencies (already in project)

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema too strict breaks valid checkpoints | Medium | High | Test against all production checkpoints |
| Validation overhead slows load | Low | Low | Zod is fast, checkpoint is small |

---

### QC-003: Type Assertion Before Validation

**Priority:** P1 (High) | **Effort:** S (1 hour) | **Status:** OPEN

#### Description
In `bulk-import.ts`, phase is cast to `ImportPhase` before validating it's a valid phase string.

#### Location
`scripts/bulk-import.ts:396-402`

```typescript
if (args.phase) {
  const phase = args.phase as ImportPhase; // Cast before validation
  if (!IMPORT_PHASES.includes(phase)) {   // Validation happens after
    console.error(`Invalid phase: ${args.phase}`);
```

#### Acceptance Criteria
1. Validate string is valid ImportPhase BEFORE casting
2. Use type guard function for safe narrowing
3. Add unit test for invalid phase handling

#### Testable Deliverables
- [ ] Unit test: `parseCliArgs rejects invalid phase with clear error`
- [ ] Refactor to use type guard: `isImportPhase()`

---

### QC-004: Fragile String-Based Error Detection

**Priority:** P1 (High) | **Effort:** M (2-4 hours) | **Status:** OPEN

#### Description
Error handling relies on string matching (`errorMsg.includes('404')`) which is fragile and could miss errors with different message formats.

#### Location
- `scripts/import-votes.ts:254-260`
- `src/ingestion/retry-handler.ts:42-58`

#### Acceptance Criteria
1. Create typed error classes (ApiNotFoundError, RateLimitError, etc.)
2. Use `instanceof` checks instead of string matching
3. Preserve original error context in wrapped errors

#### Testable Deliverables
- [ ] Create `ApiError` class hierarchy
- [ ] Unit tests for each error type detection
- [ ] Integration test: error types flow correctly through retry handler

---

### QC-005: Magic Numbers Without Constants

**Priority:** P2 (Medium) | **Effort:** S (1 hour) | **Status:** OPEN

#### Description
Various magic numbers are hardcoded without named constants, making code harder to understand and maintain.

#### Locations
- `MAX_CONSECUTIVE_ERRORS = 3` (only in votes)
- `offset > 10000` safety limit
- `limit = 250` default batch size
- Retry delays: 1000, 2000, 4000ms

#### Acceptance Criteria
1. Extract all magic numbers to named constants in `import-config.ts`
2. Document rationale for each value
3. Allow override via environment variables where appropriate

---

### QC-006: Inconsistent Logging Levels

**Priority:** P2 (Medium) | **Effort:** S (1 hour) | **Status:** OPEN

#### Description
Similar events logged at different levels across modules. Critical failures sometimes logged as 'debug' or 'warn' instead of 'error'.

#### Evidence
- `import-committees.ts`: DB errors logged as 'debug'
- `import-bills.ts`: Upsert failures logged as 'debug'
- `import-votes.ts`: 404 logged as 'info' (appropriate)

#### Acceptance Criteria
1. Create logging level guidelines document
2. Audit all log statements for appropriate level
3. Ensure all errors that could cause data loss are 'error' level

---

## Phase 3: Test Coverage Gaps

### TC-001: Import Scripts Have Zero Unit Tests

**Priority:** P0 (Critical) | **Effort:** XL (16+ hours) | **Status:** OPEN

#### Description
All 5 import scripts have 0% direct unit test coverage. Testing currently relies on integration dry-run tests and documentation tests.

#### Files Requiring Tests

| File | LOC | Complexity | Priority |
|------|-----|------------|----------|
| `import-legislators.ts` | ~300 | Medium | P0 |
| `import-committees.ts` | ~250 | Medium | P0 |
| `import-bills.ts` | ~400 | High | P0 |
| `import-votes.ts` | ~650 | Very High | P0 |
| `validate-import.ts` | ~150 | Low | P1 |
| `bulk-import.ts` | ~420 | High | P1 |

#### Acceptance Criteria
1. Each import script has ≥80% line coverage
2. Each has unit tests for:
   - Happy path (successful import)
   - API error handling
   - Transform error handling
   - Database error handling
   - Checkpoint integration
3. Tests use mocked dependencies (no real API/DB calls)

#### Testable Deliverables
- [ ] `import-legislators.test.ts` - minimum 15 test cases
- [ ] `import-committees.test.ts` - minimum 12 test cases
- [ ] `import-bills.test.ts` - minimum 20 test cases
- [ ] `import-votes.test.ts` - minimum 25 test cases
- [ ] `validate-import.test.ts` - minimum 8 test cases
- [ ] `bulk-import.test.ts` - minimum 15 test cases
- [ ] Coverage report shows ≥80% for all import scripts

#### Dependencies
- Requires proper dependency injection for mocking
- May require refactoring for testability (see ARCH-002)

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tests require significant refactoring | High | Medium | Budget time for refactoring |
| Mocks diverge from real behavior | Medium | High | Use integration tests as sanity check |

---

### TC-002: Missing Edge Case Tests

**Priority:** P1 (High) | **Effort:** M (4-8 hours) | **Status:** OPEN

#### Description
Existing tests focus on happy paths. Edge cases and error conditions need coverage.

#### Missing Test Cases
1. Empty API responses
2. Malformed API responses
3. Concurrent checkpoint access
4. Disk full during checkpoint write
5. Network timeout scenarios
6. Partial batch success (some records fail)

#### Acceptance Criteria
- [ ] Test for each edge case listed
- [ ] Property-based tests for transform functions

---

### TC-003: No Integration Tests for Full Pipeline

**Priority:** P1 (High) | **Effort:** L (8-16 hours) | **Status:** OPEN

#### Description
No automated tests verify the complete pipeline (legislators → committees → bills → votes → validate) works end-to-end with real database interactions.

#### Acceptance Criteria
1. Integration test suite using Testcontainers
2. Tests against real PostgreSQL (not mocks)
3. Tests against mock Congress.gov API (msw or similar)
4. Verifies foreign key relationships created correctly
5. Verifies checkpoint recovery works correctly

---

## Phase 4: Silent Failure Analysis

### SF-001: Transform Errors Silently Filter Records

**Priority:** P0 (Critical) | **Effort:** M (2-4 hours) | **Status:** OPEN

#### Description
When transformation fails for a record, it's filtered out with only a warning log. This causes silent data loss with no way to identify or recover missed records.

#### Location
`scripts/import-legislators.ts:216-224`

```typescript
const transformedBatch = batch.map((member) => {
  try {
    return transformMemberListItem(member);
  } catch (error) {
    log('warn', `Failed to transform member: ${error}`);
    return null;  // SILENT DATA LOSS
  }
}).filter((item) => item !== null);
```

#### Acceptance Criteria
1. Failed records collected and reported at end of phase
2. Option to fail-fast on any transform error
3. Failed record IDs logged for manual investigation
4. Metrics track transform success/failure ratio

#### Testable Deliverables
- [ ] Unit test: `importLegislators reports transform failures in summary`
- [ ] Unit test: `importLegislators --strict fails on first transform error`
- [ ] Failed records logged with full context

---

### SF-002: Database Upsert Failures Logged as Debug

**Priority:** P0 (Critical) | **Effort:** S (1 hour) | **Status:** OPEN

#### Description
Database upsert failures are logged at 'debug' level, making them invisible in production logs where debug is typically disabled.

#### Locations
- `import-committees.ts:178`
- `import-bills.ts:245`

#### Acceptance Criteria
1. All database errors logged at 'error' level
2. Include record identifier in error message
3. Track failure count in checkpoint metadata

---

### SF-003: Health Check Swallows All Errors

**Priority:** P1 (High) | **Effort:** S (1 hour) | **Status:** OPEN

#### Description
`checkApiHealth()` returns false for any error without logging, making diagnosis of API issues difficult.

#### Location
`src/ingestion/congress-client.ts:health check function`

#### Acceptance Criteria
1. Log health check failures with error details
2. Distinguish between "API down" and "auth failed" and "rate limited"
3. Health check result includes reason for failure

---

### SF-004: Default Fallback Values Hide Data Issues

**Priority:** P1 (High) | **Effort:** M (2-4 hours) | **Status:** OPEN

#### Description
Transform functions use default fallbacks for missing/invalid data, hiding data quality issues.

#### Example
```typescript
party: member.partyName || 'Unknown',
state: member.state || 'XX',
```

#### Acceptance Criteria
1. Required fields fail transform if missing
2. Optional fields with defaults are documented
3. Data quality report tracks default usage frequency

---

## Phase 5: Architecture Issues

### ARCH-001: Singleton Pattern with Global Mutable State

**Priority:** P1 (High) | **Effort:** L (8-16 hours) | **Status:** OPEN

#### Description
`CheckpointManager` uses singleton pattern with global mutable state, making testing difficult and creating potential race conditions.

#### Location
`scripts/checkpoint-manager.ts:25-35`

```typescript
let globalManager: CheckpointManager | null = null;

export function getCheckpointManager(): CheckpointManager {
  if (!globalManager) {
    globalManager = new CheckpointManager();
  }
  return globalManager;
}
```

#### Acceptance Criteria
1. Pass CheckpointManager as dependency injection
2. Remove global singleton
3. Tests can create isolated instances
4. Add file locking for concurrent access safety

---

### ARCH-002: Mixed I/O and Business Logic

**Priority:** P1 (High) | **Effort:** XL (20+ hours) | **Status:** OPEN

#### Description
Import scripts mix file I/O, API calls, database operations, and business logic in single functions, making unit testing difficult.

#### Acceptance Criteria
1. Separate pure transform functions
2. Extract API client interface
3. Extract database repository interface
4. Core import logic testable with mocks

---

### ARCH-003: Missing Circuit Breaker Pattern

**Priority:** P1 (High) | **Effort:** M (4-8 hours) | **Status:** OPEN

#### Description
No circuit breaker prevents cascade failures when Congress.gov API is degraded. System will continue hammering a failing API.

#### Acceptance Criteria
1. Implement circuit breaker with configurable thresholds
2. States: Closed, Open, Half-Open
3. Metrics exposed for monitoring
4. Integration with retry handler

---

### ARCH-004: N+1 Query Pattern in Vote Positions

**Priority:** P1 (High) | **Effort:** M (4-8 hours) | **Status:** OPEN

#### Description
Vote position upserts perform individual database queries per record instead of batching.

#### Location
`scripts/import-votes.ts:577-649`

```typescript
for (const member of batch) {
  const legislator = await prisma.legislator.findUnique({...});  // N queries
  const existing = await prisma.vote.findFirst({...});           // N queries
  await prisma.vote.create/update({...});                        // N queries
}
```

#### Acceptance Criteria
1. Batch legislator lookups with `findMany`
2. Use `createMany` or `$transaction` for bulk upserts
3. Performance benchmark before/after
4. Target: <1s for 100-record batch

---

### ARCH-005: No Transaction Boundaries

**Priority:** P1 (High) | **Effort:** M (4-8 hours) | **Status:** OPEN

#### Description
Multi-record operations not wrapped in transactions. Partial failures leave database in inconsistent state.

#### Acceptance Criteria
1. Wrap batch upserts in transactions
2. Rollback on any failure in batch
3. Checkpoint only updated after transaction commits
4. Document transaction boundaries in code

---

### ARCH-006: Tight Coupling to Prisma

**Priority:** P2 (Medium) | **Effort:** L (8-16 hours) | **Status:** OPEN

#### Description
Import scripts directly use Prisma client, making it impossible to test without database or swap storage backends.

#### Acceptance Criteria
1. Create repository interfaces
2. Prisma implementation behind interface
3. Mock implementation for testing
4. Consider in-memory implementation for dry-run

---

### ARCH-007: No Idempotency Keys

**Priority:** P2 (Medium) | **Effort:** M (4-8 hours) | **Status:** OPEN

#### Description
No idempotency keys to detect duplicate processing if import restarts mid-batch.

#### Acceptance Criteria
1. Generate idempotency key per record
2. Store in checkpoint metadata
3. Detect and skip already-processed records
4. Log when duplicates detected

---

## Recommended Fix Priority

### Immediate (Before Production)

| ID | Priority | Effort | Justification |
|-----|----------|--------|---------------|
| QC-001 | P0 | S | Infinite loop could hang production |
| QC-002 | P0 | M | Corrupted checkpoint = data corruption |
| SF-001 | P0 | M | Silent data loss unacceptable |
| SF-002 | P0 | S | Invisible errors in production |
| TC-001 | P0 | XL | Cannot validate correctness without tests |

### Short-Term (Next Sprint)

| ID | Priority | Effort | Justification |
|-----|----------|--------|---------------|
| QC-003 | P1 | S | Type safety issue |
| QC-004 | P1 | M | Fragile error detection |
| SF-003 | P1 | S | Diagnosis difficulty |
| SF-004 | P1 | M | Hidden data quality issues |
| ARCH-003 | P1 | M | Production resilience |
| ARCH-004 | P1 | M | Performance |
| ARCH-005 | P1 | M | Data consistency |
| TC-002 | P1 | M | Edge case coverage |
| TC-003 | P1 | L | Pipeline validation |

### Medium-Term (Next Quarter)

| ID | Priority | Effort | Justification |
|-----|----------|--------|---------------|
| ARCH-001 | P1 | L | Testability |
| ARCH-002 | P1 | XL | Architecture improvement |
| ARCH-006 | P2 | L | Flexibility |
| ARCH-007 | P2 | M | Robustness |
| QC-005 | P2 | S | Maintainability |
| QC-006 | P2 | S | Operability |

---

## Verification Commands

```bash
# Run full verification suite
pnpm --filter @ltip/api run typecheck
pnpm --filter @ltip/api run test

# Run dry-run to verify pipeline
pnpm --filter @ltip/api run import:reset
pnpm --filter @ltip/api run import:dry-run

# Check test coverage
pnpm --filter @ltip/api run test -- --coverage

# Check specific test files
pnpm --filter @ltip/api run test -- checkpoint-manager.test.ts
pnpm --filter @ltip/api run test -- import-votes-behavior.test.ts
```

---

## Appendix A: Files Affected

| File | Original Issues | QC Issues |
|------|-----------------|-----------|
| `scripts/bulk-import.ts` | WP7-A-001 ✅ | QC-003, ARCH-002 |
| `scripts/import-votes.ts` | WP7-A-001 ✅, WP7-A-002 ✅, WP7-A-005 ✅ | QC-001, QC-004, ARCH-004, ARCH-005 |
| `scripts/checkpoint-manager.ts` | WP7-A-001 ✅ | QC-002, ARCH-001 |
| `scripts/import-legislators.ts` | - | SF-001, TC-001 |
| `scripts/import-committees.ts` | - | SF-002, TC-001 |
| `scripts/import-bills.ts` | - | SF-002, TC-001 |
| `scripts/validate-import.ts` | - | TC-001 |
| `src/ingestion/congress-client.ts` | - | SF-003 |
| `src/ingestion/retry-handler.ts` | WP7-A-003 ✅ | QC-004 |
| `src/ingestion/data-transformer.ts` | - | SF-004 |

---

## Appendix B: Test Results Summary

```
RUN  v2.1.9 /Users/estanley/Documents/GitHub/LTI/apps/api

 ✓ src/__tests__/ingestion/congress-api.test.ts (9 tests) 58ms
 ✓ src/__tests__/ingestion/rate-limiter.test.ts (15 tests) 8ms
 ✓ src/__tests__/ingestion/retry-handler.test.ts (18 tests) 21ms
 ✓ src/__tests__/ingestion/transformers.test.ts (41 tests) 26ms
 ✓ src/__tests__/scripts/checkpoint-manager.test.ts (37 tests) 71ms
 ✓ src/__tests__/scripts/import-config.test.ts (28 tests) 13ms
 ✓ src/__tests__/utils/validation.test.ts (22 tests) 13ms
 ✓ src/__tests__/scripts/ingestion-unit.test.ts (143 tests) 62ms
 ✓ src/__tests__/utils/search-tokens.test.ts (23 tests) 7ms
 ✓ src/__tests__/scripts/import-votes-behavior.test.ts (7 tests) 3ms

 Test Files  10 passed (10)
      Tests  343 passed (343)
```

---

## Appendix C: Change Control Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-29 | 1.0.0 | Initial gap analysis document created | ODIN |
| 2026-01-29 | 1.1.0 | WP7-A-001 and WP7-A-002 resolved | ODIN |
| 2026-01-29 | 1.2.0 | WP7-A-005 (data loss prevention) resolved | ODIN |
| 2026-01-29 | 2.0.0 | Comprehensive QC analysis with parallel agent review | ODIN |

### Version 2.0.0 Changes

**Analysis Methodology:**
- Deployed 4 parallel review agents for comprehensive analysis:
  1. Code Quality Reviewer - Found 32 issues (3 P0, 8 P1)
  2. Test Coverage Analyzer - Found 22 gaps (7 P0, 6 P1)
  3. Silent Failure Hunter - Found 27 issues (4 P0, 8 P1)
  4. Architecture Reviewer - Found 23 issues (0 P0, 7 P1)

**Key Findings:**
- Production readiness assessment: NOT READY
- Total new issues identified: 104
- Critical (P0) issues requiring immediate attention: 14
- High (P1) issues for short-term resolution: 26

**Documentation Updates:**
- Added Phase 2-5 sections for new issue categories
- Updated executive summary with comprehensive metrics
- Added production readiness assessment table
- Expanded recommended fix priority with timeline

---

## Appendix D: Resolution Details (v1.x Issues)

### WP7-A-001 Resolution

**Fix Applied:** `scripts/bulk-import.ts:227-245`

Added conditional logic to `executePhase()` to detect whether resuming the same phase or starting a new phase. When starting a new phase, all progress counters are explicitly reset:

```typescript
const isResumingSamePhase = state.phase === phase && state.recordsProcessed > 0;

if (isResumingSamePhase) {
  manager.update({ lastError: null });
} else {
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

**Test Added:** `checkpoint-manager.test.ts:181-198`
- Documents that `CheckpointManager.update()` does NOT auto-reset offset when phase changes
- Verifies the orchestrator is responsible for explicit reset

**Verification:** Dry-run shows votes phase starting at `Offset 0` instead of inheriting bills phase offset.

### WP7-A-002 Resolution

**Fix Applied:** `scripts/import-votes.ts:231-278`

Added consecutive error tracking and improved 404 detection:

```typescript
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;

// In catch block:
const is404 = errorMsg.includes('404') || errorMsg.includes('Not Found');
if (is404) {
  log('info', `End of votes data at offset ${offset} (404 - no more pages)`);
  break;
}

consecutiveErrors++;
if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
  log('error', `Stopping votes pagination after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
  break;
}
```

**Verification:** Dry-run completes votes phase without 404 errors or excessive API calls.

### WP7-A-005 Resolution

**Fix Applied:** `scripts/import-votes.ts:262-275`

Removed the `offset += limit` advancement for transient errors. Now retries the SAME offset until MAX_CONSECUTIVE_ERRORS is reached:

```typescript
// Track consecutive errors at the SAME offset (WP7-A-005 FIX: prevent data loss)
consecutiveErrors++;
log('warn', `Failed to fetch votes at offset ${offset} (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${errorMsg}`);

if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
  log('error', `Stopping votes pagination after ${MAX_CONSECUTIVE_ERRORS} consecutive errors at offset ${offset}. Manual retry may be needed.`);
  break;
}

// WP7-A-005 FIX: Retry the SAME offset for transient errors (429, 500, etc.)
// Do NOT advance offset - this would permanently skip data
continue;
```

**Test Added:** `src/__tests__/scripts/import-votes-behavior.test.ts`
- Documents transient error handling behavior (data loss prevention)
- Documents consecutive error threshold behavior
- Documents integration with WP7-A-001 and WP7-A-002

**Verification:** Code review confirms no batch skipping on transient errors; errors retry same offset until threshold.
