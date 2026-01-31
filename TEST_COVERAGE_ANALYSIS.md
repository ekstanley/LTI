# LTIP Test Coverage Analysis Report

**Date:** 2026-01-30
**Project:** Legislative Tracking Intelligence Platform (LTIP)
**Implementation Status:** 32% Complete
**Analysis Scope:** Comprehensive test quality and coverage assessment

---

## Executive Summary

### Overall Test Metrics

| Component | Test Files | Test Cases | Test LOC | Coverage | Target | Gap |
|-----------|-----------|-----------|----------|----------|--------|-----|
| **API** | 20 | 461 | 7,495 | N/A* | 80% | TBD |
| **Web** | 9 | 246 | 6,436 | 42.67% | 80% | -37.33% |
| **Total** | 29 | 707 | 13,931 | ~42% | 80% | -38% |

*Coverage package not installed for API

### Test Quality Score: 68/100

**Breakdown:**
- Security Testing: 92/100 (Excellent M-1, M-2, M-3 coverage)
- Unit Testing: 75/100 (Good service/mapper coverage)
- Integration Testing: 25/100 (Critical gap)
- E2E Testing: 15/100 (Severe gap)
- Edge Case Coverage: 65/100 (Moderate)
- Route Testing: 0/100 (Missing entirely)

---

## Current Test Coverage by Layer

### 1. API Layer (apps/api)

#### What's Well Tested (461 tests)

**Services (25 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/services/bill.service.test.ts` - 12 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/services/legislator.service.test.ts` - 13 tests
- Coverage: Repository mocking, pagination, data transformation, error handling

**Mappers (81 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/mappers/bill.mapper.test.ts` - 20 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/mappers/vote.mapper.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/mappers/legislator.mapper.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/mappers/enums.test.ts` - 41 tests
- Coverage: Prisma to API transformation, enum conversions, date formatting

**Data Ingestion (128 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/ingestion/congress-client.test.ts` - 22 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/ingestion/data-transformer.test.ts` - 67 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/ingestion/rate-limiter.test.ts` - 17 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/ingestion/retry-handler.test.ts` - 22 tests
- Coverage: API client, retry logic, rate limiting, data transformation

**Middleware (76 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/middleware/__tests__/csrf.test.ts` - 21 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/middleware/authRateLimiter.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/middleware/validateRedirectUrl.test.ts` - 32 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/services/__tests__/csrf.service.test.ts` - 26 tests
- Coverage: CSRF protection, rate limiting, URL validation

**WebSocket (48 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/websocket/auth.test.ts` - 17 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/websocket/broadcast.service.test.ts` - 10 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/websocket/room-manager.test.ts` - 21 tests
- Coverage: Authentication, room management, broadcasting

**Scripts/Utilities (76 tests)**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/scripts/checkpoint-manager.test.ts` - 38 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/scripts/import-votes-behavior.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/__tests__/services/auth.lockout.test.ts` - 23 tests

#### What's NOT Tested (CRITICAL GAPS)

**API Routes (0 tests) - SEVERITY: 10/10**
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/bills.ts` - 7 endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/legislators.ts` - 5 endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/votes.ts` - 4 endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/committees.ts` - 4 endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/auth.ts` - 15+ endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/conflicts.ts` - 2 endpoints, 0 tests
- `/Users/estanley/Documents/GitHub/LTI/apps/api/src/routes/analysis.ts` - 3 endpoints, 0 tests

**Missing Service Tests**
- `committee.service.ts` - 0 tests
- `vote.service.ts` - 0 tests
- `jwt.service.ts` - 0 tests (critical for security)
- `oauth.service.ts` - 0 tests
- `password.service.ts` - 0 tests

---

### 2. Frontend Layer (apps/web)

#### What's Well Tested (246 tests)

**Security (166 tests) - EXCELLENT**
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/error-sanitization.test.ts` - 77 tests (M-1)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/input-validation.test.ts` - 82 tests (M-3)
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/api.test.ts` - ~60+ tests (includes M-2: 7 AbortSignal tests)

**API Client Layer (95% coverage) - EXCELLENT**
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/api.test.ts` - 1,218 lines
- Coverage: Error handling, retries, AbortSignal, network errors, authentication

**Utilities (100% coverage) - EXCELLENT**
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/utils.test.ts`
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/hooks/__tests__/useCsrf.test.ts`

**UI Components (Partial)**
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/components/ui/Badge.test.tsx` - 100% coverage
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/components/common/Pagination.test.tsx` - 89% coverage

**E2E Tests (1 test)**
- `/Users/estanley/Documents/GitHub/LTI/apps/web/src/lib/__tests__/csrf.e2e.test.ts`

#### What's NOT Tested (CRITICAL GAPS)

**Pages (0% coverage) - SEVERITY: 9/10**
```
src/app/page.tsx                  - 0% coverage (Home page)
src/app/bills/page.tsx            - 0% coverage (Bills list)
src/app/bills/[id]/page.tsx       - 0% coverage (Bill detail)
src/app/legislators/page.tsx      - 0% coverage (Legislators list)
src/app/legislators/[id]/page.tsx - 0% coverage (Legislator detail)
src/app/votes/page.tsx            - 0% coverage (Votes list)
src/app/error.tsx                 - 0% coverage (Error boundary)
src/app/global-error.tsx          - 0% coverage (Global error)
```

**Page Client Components (0% coverage) - SEVERITY: 10/10**
```
BillsPageClient.tsx        - 0% coverage (193 lines)
BillDetailClient.tsx       - 0% coverage (224 lines)
LegislatorsPageClient.tsx  - 0% coverage (299 lines)
LegislatorDetailClient.tsx - 0% coverage (134 lines)
VotesPageClient.tsx        - 0% coverage (400 lines)
```

**Common Components (0% coverage) - SEVERITY: 8/10**
```
Navigation.tsx      - 0% coverage (115 lines)
ErrorBoundary.tsx   - 0% coverage (93 lines)
LoadingState.tsx    - 0% coverage (107 lines)
EmptyState.tsx      - 0% coverage (86 lines)
```

**Bill Components (0% coverage) - SEVERITY: 7/10**
```
BillCard.tsx        - 0% coverage
BiasSpectrum.tsx    - 0% coverage
```

**Hooks (0% coverage) - SEVERITY: 8/10**
```
useBills.ts         - 0% coverage
useLegislators.ts   - 0% coverage
useVotes.ts         - 0% coverage
useDebounce.ts      - 0% coverage
```

---

## Top 10 Critical Testing Gaps (Prioritized by Risk)

### 1. API Route Integration Tests (Criticality: 10/10)
**Risk:** Route middleware, validation, authentication, error handling untested
**Impact:** Production bugs in endpoint behavior, security vulnerabilities
**Estimated Effort:** 3-4 days

**Missing Coverage:**
- Request validation (Zod schemas)
- Authentication/authorization middleware
- Error responses and status codes
- Pagination parameters
- Rate limiting behavior
- CSRF token validation in routes

**Example Test Needed:**
```typescript
// apps/api/src/routes/__tests__/bills.routes.test.ts
describe('GET /api/v1/bills', () => {
  it('should return paginated bills with correct format', async () => {
    const response = await request(app)
      .get('/api/v1/bills?limit=20&offset=0')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.data).toBeInstanceOf(Array);
  });

  it('should reject invalid pagination parameters', async () => {
    await request(app)
      .get('/api/v1/bills?limit=-1')
      .expect(400);
  });

  it('should filter by congress number', async () => {
    const response = await request(app)
      .get('/api/v1/bills?congressNumber=118')
      .expect(200);

    response.body.data.forEach((bill: any) => {
      expect(bill.congressNumber).toBe(118);
    });
  });
});
```

---

### 2. Frontend Page Client Components (Criticality: 10/10)
**Risk:** User-facing features untested (1,250+ lines of critical UI logic)
**Impact:** UI bugs, broken user flows, data display errors
**Estimated Effort:** 4-5 days

**Missing Coverage:**
- Data fetching and SWR integration
- Loading states
- Error handling and display
- Pagination interaction
- Search/filter functionality
- Bill/Legislator/Vote detail rendering

**Example Test Needed:**
```typescript
// apps/web/src/app/bills/__tests__/BillsPageClient.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { BillsPageClient } from '../BillsPageClient';

describe('BillsPageClient', () => {
  it('should display loading state initially', () => {
    render(<BillsPageClient />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('should fetch and display bills', async () => {
    render(<BillsPageClient />);
    await waitFor(() => {
      expect(screen.getByText(/HR 1234/)).toBeInTheDocument();
    });
  });

  it('should handle pagination', async () => {
    const { container } = render(<BillsPageClient />);
    const nextButton = screen.getByLabelText('Next page');
    fireEvent.click(nextButton);
    // Verify URL updated and new data loaded
  });

  it('should display error state on API failure', async () => {
    // Mock API failure
    render(<BillsPageClient />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });
});
```

---

### 3. Authentication Route Tests (Criticality: 10/10)
**Risk:** Critical security vulnerabilities in auth flow
**Impact:** Account takeover, unauthorized access, token leakage
**Estimated Effort:** 2-3 days

**Missing Coverage:**
- Register endpoint (email validation, password requirements)
- Login endpoint (lockout after failed attempts, token generation)
- Token refresh (rotation, invalidation)
- Logout (token revocation)
- OAuth flows (GitHub, Google)
- Session management
- Password change/reset

**Example Test Needed:**
```typescript
// apps/api/src/routes/__tests__/auth.routes.test.ts
describe('POST /api/v1/auth/register', () => {
  it('should create user and return access token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123',
        name: 'Test User'
      })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('should reject weak passwords', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: '12345' })
      .expect(400);
  });

  it('should prevent duplicate email registration', async () => {
    // Register first user
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'SecureP@ss123' });

    // Attempt duplicate
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'Different123' })
      .expect(409);
  });
});
```

---

### 4. Custom React Hooks (Criticality: 8/10)
**Risk:** Data fetching, state management, and side effects untested
**Impact:** Incorrect data display, memory leaks, stale data
**Estimated Effort:** 1-2 days

**Missing Coverage:**
- `useBills.ts` - Bill fetching, pagination, caching
- `useLegislators.ts` - Legislator fetching, search
- `useVotes.ts` - Vote fetching, filtering
- `useDebounce.ts` - Debounce timing, cleanup

**Example Test Needed:**
```typescript
// apps/web/src/hooks/__tests__/useBills.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useBills } from '../useBills';

describe('useBills', () => {
  it('should fetch bills on mount', async () => {
    const { result } = renderHook(() => useBills({ limit: 20 }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });

  it('should refetch when pagination changes', async () => {
    const { result, rerender } = renderHook(
      ({ offset }) => useBills({ limit: 20, offset }),
      { initialProps: { offset: 0 } }
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ offset: 20 });

    await waitFor(() => {
      expect(result.current.data?.pagination.offset).toBe(20);
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock API error
    const { result } = renderHook(() => useBills({ limit: 20 }));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

---

### 5. Common UI Components (Criticality: 8/10)
**Risk:** Shared components used across pages untested
**Impact:** Widespread UI failures affecting multiple pages
**Estimated Effort:** 2 days

**Missing Coverage:**
- `Navigation.tsx` - Route navigation, active states, responsive behavior
- `ErrorBoundary.tsx` - Error catching, fallback rendering, retry logic
- `LoadingState.tsx` - Skeleton rendering, accessibility
- `EmptyState.tsx` - Conditional rendering, action buttons

**Example Test Needed:**
```typescript
// apps/web/src/components/common/__tests__/Navigation.test.tsx
describe('Navigation', () => {
  it('should highlight active route', () => {
    render(<Navigation />, { initialEntries: ['/bills'] });
    expect(screen.getByRole('link', { name: /Bills/ })).toHaveAttribute('aria-current', 'page');
  });

  it('should render all navigation links', () => {
    render(<Navigation />);
    expect(screen.getByRole('link', { name: /Bills/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Legislators/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Votes/ })).toBeInTheDocument();
  });

  it('should be keyboard navigable', () => {
    render(<Navigation />);
    const links = screen.getAllByRole('link');
    links[0]?.focus();
    expect(links[0]).toHaveFocus();
  });
});
```

---

### 6. Service Layer Coverage for Critical Services (Criticality: 9/10)
**Risk:** Core business logic untested for auth, committees, votes
**Impact:** Data integrity issues, security vulnerabilities
**Estimated Effort:** 2-3 days

**Missing Coverage:**
- `jwt.service.ts` - Token signing, verification, expiration
- `password.service.ts` - Hashing, validation, strength checks
- `oauth.service.ts` - OAuth flows, provider integration
- `committee.service.ts` - Committee data operations
- `vote.service.ts` - Vote data operations

**Example Test Needed:**
```typescript
// apps/api/src/services/__tests__/jwt.service.test.ts
describe('JwtService', () => {
  it('should generate valid access tokens', () => {
    const token = jwtService.generateAccessToken({ userId: '123' });
    const decoded = jwtService.verifyAccessToken(token);
    expect(decoded.userId).toBe('123');
  });

  it('should reject expired tokens', () => {
    const token = jwtService.generateAccessToken({ userId: '123' }, '0s');
    expect(() => jwtService.verifyAccessToken(token)).toThrow('Token expired');
  });

  it('should reject tampered tokens', () => {
    const token = jwtService.generateAccessToken({ userId: '123' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => jwtService.verifyAccessToken(tampered)).toThrow();
  });
});
```

---

### 7. End-to-End User Flows (Criticality: 9/10)
**Risk:** Integration between frontend, API, and database untested
**Impact:** Critical user journeys broken in production
**Estimated Effort:** 3-4 days

**Missing Coverage:**
- User registration and login flow
- Browse bills → View detail → View sponsors
- Search legislators → View detail → View votes
- Filter votes by congress/chamber/outcome
- Pagination across all list views
- Error recovery flows

**Example Test Needed:**
```typescript
// apps/web/e2e/bill-browsing.e2e.test.ts
describe('Bill Browsing Flow', () => {
  it('should allow user to browse and view bill details', async () => {
    // Navigate to bills page
    await page.goto('/bills');

    // Verify bills list loads
    await expect(page.getByRole('list')).toBeVisible();

    // Click first bill
    await page.getByRole('link', { name: /HR \d+/ }).first().click();

    // Verify bill detail page
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Click sponsors tab
    await page.getByRole('tab', { name: 'Sponsors' }).click();

    // Verify sponsors load
    await expect(page.getByText(/Primary Sponsor/)).toBeVisible();
  });
});
```

---

### 8. Validation Schema Coverage (Criticality: 7/10)
**Risk:** Input validation rules not verified against malicious input
**Impact:** SQL injection, XSS, data corruption
**Estimated Effort:** 1-2 days

**Missing Coverage:**
- All Zod schemas in `/apps/api/src/schemas/`
- Boundary value testing
- Malicious input handling
- Type coercion edge cases

**Example Test Needed:**
```typescript
// apps/api/src/schemas/__tests__/bills.schema.test.ts
describe('listBillsSchema', () => {
  it('should accept valid pagination parameters', () => {
    const result = listBillsSchema.parse({
      limit: 20,
      offset: 0,
      congressNumber: 118
    });
    expect(result.limit).toBe(20);
  });

  it('should reject negative offset', () => {
    expect(() => listBillsSchema.parse({ offset: -1 })).toThrow();
  });

  it('should cap limit at maximum', () => {
    const result = listBillsSchema.parse({ limit: 1000 });
    expect(result.limit).toBeLessThanOrEqual(100);
  });

  it('should sanitize search input', () => {
    const malicious = '<script>alert("xss")</script>';
    expect(() => listBillsSchema.parse({ search: malicious })).toThrow();
  });
});
```

---

### 9. WebSocket Real-Time Features (Criticality: 7/10)
**Risk:** Real-time updates, connection handling partially tested
**Impact:** Failed subscriptions, stale data, connection leaks
**Estimated Effort:** 2 days

**Missing Coverage:**
- Connection lifecycle (connect, disconnect, reconnect)
- Message routing and delivery
- Room subscription/unsubscription
- Error handling for network failures
- Rate limiting enforcement

**Example Test Needed:**
```typescript
// apps/api/src/websocket/__tests__/integration.test.ts
describe('WebSocket Integration', () => {
  it('should handle client connect/disconnect', async () => {
    const client = await createTestClient();
    expect(client.isConnected()).toBe(true);

    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('should broadcast bill updates to subscribed rooms', async () => {
    const client = await createTestClient();
    await client.subscribe('bill-updates-118');

    // Trigger bill update
    await updateBill('hr-1234-118', { status: 'PASSED_HOUSE' });

    const message = await client.waitForMessage();
    expect(message.type).toBe('bill-updated');
    expect(message.data.id).toBe('hr-1234-118');
  });
});
```

---

### 10. Accessibility (a11y) Testing (Criticality: 6/10)
**Risk:** WCAG compliance violations, unusable for disabled users
**Impact:** Legal liability, poor UX for assistive tech users
**Estimated Effort:** 2 days

**Missing Coverage:**
- Keyboard navigation
- Screen reader compatibility
- Focus management
- ARIA attributes
- Color contrast
- Form labels and error announcements

**Example Test Needed:**
```typescript
// apps/web/src/components/__tests__/a11y.test.tsx
import { axe } from 'jest-axe';

describe('Accessibility', () => {
  it('should have no a11y violations on bills page', async () => {
    const { container } = render(<BillsPageClient />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', () => {
    render(<BillsPageClient />);
    const firstLink = screen.getAllByRole('link')[0];
    firstLink?.focus();
    expect(firstLink).toHaveFocus();

    userEvent.tab();
    expect(screen.getAllByRole('link')[1]).toHaveFocus();
  });
});
```

---

## Test Quality Assessment

### Strengths

1. **Security Testing (92/100)** - Excellent coverage of M-1, M-2, M-3 mitigations
   - Error sanitization: 77 comprehensive tests
   - Input validation: 82 tests covering XSS, SQL injection
   - AbortSignal propagation: 7 tests preventing request leaks

2. **API Client Layer (95% coverage)** - Well-tested error handling, retries, network failures
   - 1,218 lines of test code
   - Comprehensive edge case coverage
   - Good assertion specificity

3. **Data Mappers (81 tests)** - Solid transformation testing
   - Type safety verified
   - Enum conversions tested
   - Date formatting covered

4. **Ingestion Layer (128 tests)** - Robust external API handling
   - Rate limiting tested
   - Retry logic verified
   - Error recovery covered

### Weaknesses

1. **No Route Testing (0/100)** - Critical gap
   - 40+ endpoints untested
   - No integration testing
   - Middleware behavior unverified

2. **No Page Component Testing (0/100)** - User-facing features untested
   - 1,250+ lines of UI logic uncovered
   - Data fetching not verified
   - User interactions untested

3. **Minimal E2E Coverage (15/100)** - Only 1 E2E test
   - No user journey testing
   - No cross-component integration

4. **Missing Service Tests (35/100)** - Core business logic gaps
   - JWT service untested (security risk)
   - OAuth flows unverified
   - Committee/vote services missing

---

## Recommended Coverage Targets

### Phase 1: Critical Path (2-3 weeks)

**Target: 65% overall coverage**

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| API Routes | 0% | 80% | Critical |
| Auth Services | 0% | 90% | Critical |
| Page Components | 0% | 60% | High |
| Custom Hooks | 0% | 75% | High |

### Phase 2: Comprehensive (4-6 weeks)

**Target: 80% overall coverage**

| Component | Phase 1 | Target | Priority |
|-----------|---------|--------|----------|
| Common Components | 0% | 80% | Medium |
| Service Layer | 30% | 80% | High |
| E2E Tests | 1 test | 15 tests | High |
| a11y Testing | 0% | 60% | Medium |

---

## Test Architecture Recommendations

### 1. Test Organization Structure

```
apps/api/src/
├── __tests__/
│   ├── integration/           # NEW: Route integration tests
│   │   ├── auth.routes.test.ts
│   │   ├── bills.routes.test.ts
│   │   └── legislators.routes.test.ts
│   ├── e2e/                   # NEW: Full API E2E tests
│   │   ├── bill-lifecycle.test.ts
│   │   └── user-journey.test.ts
│   ├── services/              # Expand existing
│   │   ├── jwt.service.test.ts      # NEW
│   │   ├── oauth.service.test.ts    # NEW
│   │   ├── password.service.test.ts # NEW
│   │   └── committee.service.test.ts # NEW
│   └── schemas/               # NEW: Schema validation tests
│       └── bills.schema.test.ts

apps/web/src/
├── __tests__/
│   ├── e2e/                   # NEW: Browser E2E tests
│   │   ├── bill-browsing.e2e.test.ts
│   │   ├── legislator-search.e2e.test.ts
│   │   └── vote-filtering.e2e.test.ts
│   ├── integration/           # NEW: Component integration
│   │   ├── BillsPageClient.test.tsx
│   │   └── LegislatorsPageClient.test.tsx
│   └── a11y/                  # NEW: Accessibility tests
│       └── navigation.a11y.test.tsx
```

### 2. Test Fixtures and Factories

Create reusable test data factories:

```typescript
// apps/api/src/__tests__/fixtures/bill.factory.ts
export const createMockBill = (overrides?: Partial<Bill>): Bill => ({
  id: 'hr-1234-118',
  billType: 'HR',
  billNumber: 1234,
  congressNumber: 118,
  title: 'Test Bill Act',
  status: 'INTRODUCED',
  introducedDate: new Date('2023-01-15'),
  ...overrides
});
```

### 3. Test Database Strategy

**Recommendation:** Use Testcontainers for isolated database tests

```typescript
// apps/api/src/__tests__/setup/database.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export async function setupTestDatabase() {
  const container = await new PostgreSqlContainer()
    .withDatabase('ltip_test')
    .start();

  process.env.DATABASE_URL = container.getConnectionString();

  // Run migrations
  await runMigrations();

  return container;
}
```

### 4. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Run integration tests
        run: pnpm test:integration

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Generate coverage report
        run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
          threshold: 80%
```

---

## Effort Estimation

### Summary Table

| Phase | Tasks | Est. Hours | Est. Days | Priority |
|-------|-------|-----------|-----------|----------|
| **Phase 1: Critical Path** | | | | |
| API Route Tests | 40+ endpoints | 24-32h | 3-4d | P0 |
| Auth Service Tests | JWT, OAuth, Password | 16-24h | 2-3d | P0 |
| Page Component Tests | 5 client components | 32-40h | 4-5d | P0 |
| Custom Hook Tests | 4 hooks | 8-16h | 1-2d | P0 |
| **Phase 1 Subtotal** | | 80-112h | 10-14d | |
| | | | | |
| **Phase 2: Comprehensive** | | | | |
| Common Component Tests | 4 components | 16h | 2d | P1 |
| Service Layer Tests | 3 services | 16-24h | 2-3d | P1 |
| E2E Test Suite | 15 tests | 24-32h | 3-4d | P1 |
| Validation Schema Tests | 8 schemas | 8-16h | 1-2d | P1 |
| WebSocket Integration | Connection, routing | 16h | 2d | P1 |
| a11y Testing | All pages/components | 16h | 2d | P2 |
| **Phase 2 Subtotal** | | 96-120h | 12-15d | |
| | | | | |
| **Infrastructure** | | | | |
| Test fixtures/factories | Reusable mocks | 8h | 1d | P0 |
| Testcontainers setup | DB isolation | 4h | 0.5d | P0 |
| CI/CD integration | GitHub Actions | 4h | 0.5d | P0 |
| Coverage tooling | Install, configure | 2h | 0.25d | P0 |
| **Infrastructure Subtotal** | | 18h | 2.25d | |
| | | | | |
| **TOTAL** | | 194-250h | 24-31d | |

**Assumptions:**
- 1 engineer working full-time on testing
- Includes test writing, debugging, and documentation
- Assumes moderate familiarity with codebase
- Includes time for test infrastructure setup

---

## Specific Test Examples by Category

### API Route Test Example

```typescript
// apps/api/src/routes/__tests__/bills.routes.test.ts
import request from 'supertest';
import { app } from '../../app';
import { createMockBill } from '../fixtures/bill.factory';

describe('Bills Routes', () => {
  describe('GET /api/v1/bills', () => {
    it('should return 200 with paginated bills', async () => {
      const response = await request(app)
        .get('/api/v1/bills')
        .query({ limit: 20, offset: 0 })
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        pagination: {
          total: expect.any(Number),
          limit: 20,
          offset: 0,
          hasMore: expect.any(Boolean)
        }
      });
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/v1/bills')
        .query({ limit: -1 })
        .expect(400);
    });

    it('should filter by congress number', async () => {
      const response = await request(app)
        .get('/api/v1/bills')
        .query({ congressNumber: 118 })
        .expect(200);

      response.body.data.forEach((bill: any) => {
        expect(bill.congressNumber).toBe(118);
      });
    });

    it('should search by title', async () => {
      const response = await request(app)
        .get('/api/v1/bills')
        .query({ search: 'infrastructure' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/bills/:id', () => {
    it('should return bill details', async () => {
      const response = await request(app)
        .get('/api/v1/bills/hr-1234-118')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'hr-1234-118',
        title: expect.any(String),
        status: expect.any(String)
      });
    });

    it('should return 404 for non-existent bill', async () => {
      await request(app)
        .get('/api/v1/bills/nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/v1/bills/:id/sponsors', () => {
    it('should return primary sponsor and cosponsors', async () => {
      const response = await request(app)
        .get('/api/v1/bills/hr-1234-118/sponsors')
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            isPrimarySponsor: expect.any(Boolean)
          })
        ])
      );
    });
  });
});
```

### Frontend Page Component Test Example

```typescript
// apps/web/src/app/bills/__tests__/BillsPageClient.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BillsPageClient } from '../BillsPageClient';
import { SWRConfig } from 'swr';

const renderWithSWR = (component: React.ReactElement) => {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      {component}
    </SWRConfig>
  );
};

describe('BillsPageClient', () => {
  it('should display loading skeleton on initial load', () => {
    renderWithSWR(<BillsPageClient />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should fetch and display bills', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'hr-1234-118', title: 'Test Bill', status: 'introduced' }
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false }
      })
    });

    renderWithSWR(<BillsPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Test Bill')).toBeInTheDocument();
    });
  });

  it('should handle pagination', async () => {
    renderWithSWR(<BillsPageClient />);

    await waitFor(() => {
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText('Next page');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      );
    });
  });

  it('should display error state on API failure', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    renderWithSWR(<BillsPageClient />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load bills/)).toBeInTheDocument();
    });
  });

  it('should filter bills by congress number', async () => {
    renderWithSWR(<BillsPageClient />);

    const congressFilter = screen.getByLabelText('Congress Number');
    fireEvent.change(congressFilter, { target: { value: '118' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('congressNumber=118'),
        expect.any(Object)
      );
    });
  });

  it('should search bills by title', async () => {
    renderWithSWR(<BillsPageClient />);

    const searchInput = screen.getByPlaceholderText('Search bills...');
    fireEvent.change(searchInput, { target: { value: 'infrastructure' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=infrastructure'),
        expect.any(Object)
      );
    }, { timeout: 500 }); // Account for debounce
  });
});
```

### E2E Test Example

```typescript
// apps/web/e2e/bill-browsing.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Bill Browsing Flow', () => {
  test('user can browse bills and view details', async ({ page }) => {
    // Navigate to bills page
    await page.goto('/bills');

    // Verify bills list loads
    await expect(page.getByRole('heading', { name: 'Bills' })).toBeVisible();
    await expect(page.getByTestId('bill-list')).toBeVisible();

    // Verify bill cards render
    const billCards = page.getByTestId('bill-card');
    await expect(billCards.first()).toBeVisible();

    // Click first bill to view details
    const firstBillTitle = await billCards.first().getByRole('heading').textContent();
    await billCards.first().click();

    // Verify bill detail page
    await expect(page).toHaveURL(/\/bills\/[a-z]+-\d+-\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(firstBillTitle!);

    // Verify tabs render
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sponsors' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Actions' })).toBeVisible();

    // Click sponsors tab
    await page.getByRole('tab', { name: 'Sponsors' }).click();
    await expect(page.getByText(/Primary Sponsor/)).toBeVisible();
  });

  test('user can filter bills by congress', async ({ page }) => {
    await page.goto('/bills');

    // Select congress filter
    await page.getByLabel('Congress Number').selectOption('118');

    // Wait for filtered results
    await page.waitForResponse(response =>
      response.url().includes('congressNumber=118') && response.ok()
    );

    // Verify filtered bills display
    const billCards = page.getByTestId('bill-card');
    await expect(billCards.first()).toBeVisible();
  });

  test('user can search bills', async ({ page }) => {
    await page.goto('/bills');

    // Enter search query
    const searchInput = page.getByPlaceholder('Search bills...');
    await searchInput.fill('infrastructure');

    // Wait for debounced search
    await page.waitForTimeout(500);

    // Verify search results
    await page.waitForResponse(response =>
      response.url().includes('search=infrastructure') && response.ok()
    );

    const billCards = page.getByTestId('bill-card');
    await expect(billCards.first()).toBeVisible();
  });

  test('user can paginate through bills', async ({ page }) => {
    await page.goto('/bills');

    // Wait for initial load
    await expect(page.getByTestId('bill-list')).toBeVisible();

    // Click next page
    const nextButton = page.getByLabel('Next page');
    await nextButton.click();

    // Verify URL updated
    await expect(page).toHaveURL(/offset=20/);

    // Verify new bills loaded
    await page.waitForResponse(response =>
      response.url().includes('offset=20') && response.ok()
    );
  });
});
```

---

## ML/AI Component Test Structure (Future)

When ML/AI features are implemented, add these test categories:

### 1. Model Inference Tests
```typescript
// apps/api/src/__tests__/ml/bill-classifier.test.ts
describe('BillClassifier', () => {
  it('should classify bill topics correctly', async () => {
    const text = 'An act to improve healthcare access...';
    const result = await classifier.predict(text);
    expect(result.topics).toContain('healthcare');
  });

  it('should handle edge cases (empty, very long)', async () => {
    expect(() => classifier.predict('')).toThrow();
  });
});
```

### 2. Bias Detection Tests
```typescript
describe('BiasDetector', () => {
  it('should detect partisan language', async () => {
    const text = 'radical socialist agenda';
    const bias = await detector.analyzeBias(text);
    expect(bias.score).toBeGreaterThan(0.7);
    expect(bias.direction).toBe('conservative');
  });
});
```

### 3. Prediction Quality Tests
```typescript
describe('LegislativeOutcomePredictor', () => {
  it('should predict passage probability', async () => {
    const bill = createMockBill({ cosponsorsD: 150, cosponsorsR: 50 });
    const prediction = await predictor.predictPassage(bill);
    expect(prediction.probability).toBeGreaterThan(0.6);
  });
});
```

---

## Conclusion

The LTIP project has a **solid foundation in security testing (92/100)** with excellent M-1, M-2, and M-3 mitigation coverage. The **API client layer is well-tested (95% coverage)**, demonstrating good engineering practices for error handling and network resilience.

However, **critical gaps exist** in:
1. **API route integration testing (0 tests)** - highest risk
2. **Frontend page components (0% coverage)** - user-facing features untested
3. **Core auth services (0% coverage)** - security vulnerability
4. **E2E testing (1 test)** - integration untested

**Recommended Action Plan:**

**Week 1-2:** API route tests + Auth service tests (P0)
**Week 3-4:** Page component tests + Custom hooks (P0)
**Week 5-6:** E2E tests + Service layer completion (P1)
**Week 7-8:** Common components + a11y + Infrastructure (P1-P2)

**Total Effort:** 24-31 days (1 engineer) to reach 80% coverage target

**ROI:** High - These tests will prevent regression bugs, improve code quality, and enable confident refactoring. The security and route tests are **critical for production readiness**.

---

**Report Generated:** 2026-01-30
**Next Review:** After Phase 1 completion (Week 2)
**Maintained By:** Test Coverage Working Group
