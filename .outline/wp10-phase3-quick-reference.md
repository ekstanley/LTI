# WP10 Phase 3: Quick Reference - Integration Tests

**Goal**: Implement 16 integration tests for API middleware in 2 hours
**File**: `apps/api/src/middleware/__tests__/routeValidation.test.ts`
**Coverage Target**: 100% on `routeValidation.ts`

---

## Execution Checklist (2 Hours)

### Hour 1: Setup + Bills Tests

**✅ Step 1: Create Test File** (5 min)
```bash
cd /Users/estanley/Documents/GitHub/LTI
mkdir -p apps/api/src/middleware/__tests__
touch apps/api/src/middleware/__tests__/routeValidation.test.ts
```

**✅ Step 2: Add Test Boilerplate** (10 min)
```typescript
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateBillIdParam, validateLegislatorIdParam } from '../routeValidation';

describe('Route Validation Middleware', () => {
  describe('validateBillIdParam', () => {
    // Bills tests here
  });

  describe('validateLegislatorIdParam', () => {
    // Legislators tests here
  });
});
```

**✅ Step 3: Implement Bills Tests** (45 min)
- TC-INT-01: Valid ID → next()
- TC-INT-02: Multiple valid formats
- TC-INT-03: Invalid ID → 400
- TC-INT-04: Empty ID → 400
- TC-INT-05: XSS → 400
- TC-INT-06: ReDoS → fast 400
- TC-INT-07: Error structure
- TC-INT-08: Error context

### Hour 2: Legislators Tests + Verification

**✅ Step 4: Implement Legislators Tests** (30 min)
- TC-INT-09 to TC-INT-16 (mirror bills tests)

**✅ Step 5: Run Tests** (10 min)
```bash
pnpm test --filter=@ltip/api
```

**✅ Step 6: Verify Coverage** (10 min)
```bash
pnpm test --filter=@ltip/api --coverage
# Expect: 100% on routeValidation.ts
```

**✅ Step 7: Document Results** (10 min)
- Capture metrics
- Update WP10 completion report

---

## Test Pattern Template

### Pattern 1: Valid ID Test
```typescript
it('should call next() for valid bill ID', () => {
  const req = { params: { id: 'hr-1234-118' } } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();

  validateBillIdParam(req, res, next);

  expect(next).toHaveBeenCalledOnce();
});
```

### Pattern 2: Invalid ID Test
```typescript
it('should return 400 for invalid bill ID', () => {
  const req = { params: { id: 'INVALID-ID' } } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
  const next = vi.fn();

  validateBillIdParam(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.any(String),
      code: 'INVALID_FORMAT'
    })
  );
  expect(next).not.toHaveBeenCalled();
});
```

### Pattern 3: Performance Test
```typescript
it('should reject ReDoS attempts in <10ms', () => {
  const maliciousId = 'a'.repeat(100000) + '-1-118';
  const req = { params: { id: maliciousId } } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
  const next = vi.fn();

  const start = performance.now();
  validateBillIdParam(req, res, next);
  const duration = performance.now() - start;

  expect(res.status).toHaveBeenCalledWith(400);
  expect(duration).toBeLessThan(10);
});
```

---

## Test Data

### Valid Bill IDs
- `hr-1234-118`
- `s-567-119`
- `hjres-45-118`
- `hconres-9999-119`

### Invalid Bill IDs
- `''` → EMPTY_VALUE
- `INVALID` → INVALID_FORMAT
- `'a'.repeat(100)` → EXCEEDS_MAX_LENGTH
- `<script>alert("xss")</script>` → INVALID_FORMAT

### Valid Legislator IDs
- `A000360`
- `S001198`
- `Z999999`

### Invalid Legislator IDs
- `''` → EMPTY_VALUE
- `INVALID` → INVALID_FORMAT
- `'A' + '0'.repeat(100)` → EXCEEDS_MAX_LENGTH
- `a000360` → INVALID_FORMAT

---

## Verification Commands

```bash
# Run all API tests
pnpm test --filter=@ltip/api

# Run only middleware tests
pnpm test --filter=@ltip/api routeValidation

# Run with coverage
pnpm test --filter=@ltip/api --coverage

# Watch mode for development
pnpm test --filter=@ltip/api --watch
```

---

## Expected Coverage Output

```
File                              | Lines  | Branches | Functions | Statements
----------------------------------|--------|----------|-----------|------------
middleware/routeValidation.ts     | 100%   | 100%     | 100%      | 100%
```

---

## Success Criteria

✅ **16 tests passing** (8 bills + 8 legislators)
✅ **100% coverage** on routeValidation.ts
✅ **Performance** all <10ms
✅ **No test failures**
✅ **Clean test output**

---

## Common Issues & Solutions

**Issue**: Tests fail with import errors
**Solution**: Check tsconfig.json includes test files

**Issue**: Mock not working correctly
**Solution**: Ensure `vi.fn()` imported from vitest

**Issue**: Performance tests unstable
**Solution**: Run multiple times, check for consistent <10ms

**Issue**: Coverage not 100%
**Solution**: Verify all code paths tested (valid + all error cases)

---

**Quick Start**: Copy test patterns, replace IDs, run tests, verify coverage!
