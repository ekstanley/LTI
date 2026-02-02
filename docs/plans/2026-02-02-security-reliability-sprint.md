# Security & Reliability Sprint - ODIN Execution Plan

**Date**: 2026-02-02
**Planning Method**: ODIN (Outline Driven INtelligence) with sequential-thinking
**Sprint Type**: Security Enhancement & Reliability Improvement
**Total Effort**: 13-19 hours (realistic: 15h)
**Timeline**: 2-3 working days with parallelization

---

## Executive Summary

This sprint addresses three interconnected P1-HIGH issues focused on authentication security and system reliability:

1. **Issue #17**: Centralized Authentication State Management (Foundation)
2. **Issue #4**: Account Lockout Protection - CVSS 7.5 (Security Critical)
3. **Issue #19**: Retry Logic with Exponential Backoff (Reliability)

**Key Achievement**: Resolves CVSS 7.5 security vulnerability while improving authentication UX and API reliability.

---

## Issues Overview

### Issue #17: Centralized Authentication State Management
**Priority**: P1-HIGH
**Component**: Frontend (apps/web/src/contexts/)
**Effort**: 6-8 hours
**Status**: Foundation - MUST complete first

**Problem**: No centralized authentication state management. Auth state scattered across components.

**Solution**: Implement React Context for authentication with:
- AuthContext provider
- useAuth hook for component consumption
- ProtectedRoute wrapper component
- Session persistence in localStorage
- Automatic token refresh

**Acceptance Criteria**:
- ✅ AuthContext implementation with login/logout/session state
- ✅ useAuth hook provides auth state to components
- ✅ ProtectedRoute redirects unauthenticated users
- ✅ Session persistence across page reloads
- ✅ 25+ comprehensive tests
- ✅ 4 visual verification screenshots

---

### Issue #4: Account Lockout Protection (CVSS 7.5)
**Priority**: P1-HIGH (Security Critical)
**Component**: Backend (apps/api/)
**Effort**: 4-6 hours
**CVSS Score**: 7.5 (HIGH) - Prevents brute force attacks

**Problem**: No protection against credential stuffing and brute force attacks.

**Solution**: Implement Redis-based account lockout with:
- Track failed login attempts per user account
- Lock account after 5 failed attempts within 15-minute window
- Exponential backoff: 15min → 30min → 1hr → 4hr → 24hr
- Email notification on account lockout
- Admin unlock functionality

**Acceptance Criteria**:
- ✅ Failed login tracking in Redis
- ✅ 5 attempts / 15min window triggers lockout
- ✅ Exponential backoff implemented
- ✅ Email notifications sent on lockout
- ✅ Admin unlock endpoint with authentication
- ✅ 20 integration tests
- ✅ Performance: <5ms Redis lookup
- ✅ 3 visual verification screenshots

---

### Issue #19: Retry Logic with Exponential Backoff
**Priority**: P1-HIGH
**Component**: Frontend (apps/web/src/hooks/)
**Effort**: 4 hours

**Problem**: No retry mechanism for failed API requests. Poor UX on transient network errors.

**Solution**: Implement exponential backoff retry logic:
- Retry on network errors (1s, 2s, 4s delays)
- Max 3 retries (7s total)
- Don't retry on 4xx errors (except 429 rate limit)
- Integrate in all data hooks (useBills, useLegislators, useVotes)

**Acceptance Criteria**:
- ✅ useRetry hook with exponential backoff
- ✅ Max 3 retries enforced
- ✅ Smart retry logic (skip 4xx except 429)
- ✅ Integrated in all data hooks
- ✅ 15 hook tests
- ✅ Loading states during retries
- ✅ 3 visual verification screenshots

---

## Dependency Analysis

### Critical Dependencies

**Dependency Flow**:
```
Issue #17 (AuthContext) → FOUNDATION
    ↓
Issue #19 (Retry Logic) → DEPENDS ON #17
    - Needs useAuth to check authentication state
    - Needs to handle 401 (redirect to login via auth context)
    ↓
Issue #4 (Account Lockout) → DEPENDS ON #17 (partially)
    - Backend implementation is independent
    - Frontend lockout messaging needs AuthContext
```

**Execution Strategy**:
- **Batch 1 (Sequential)**: Implement AuthContext (#17) first - MUST complete
- **Batch 2 (Parallel)**: After Batch 1, deploy Account Lockout (#4) and Retry Logic (#19) in parallel

**Timeline Impact**:
- **With Parallelization**: 10-14 hours
- **Without Parallelization**: 14-18 hours
- **Savings**: 4 hours (28% faster)

---

## Risk Assessment

### Issue #17 (AuthContext) - MEDIUM RISK
**Risk**: Breaking existing auth flow
**Blast Radius**: All authenticated pages
**Mitigation**:
- Incremental rollout (AuthContext first, then migrate pages)
- Comprehensive tests before integration
- Feature flag if needed

**Rollback**: Revert to component-level auth state

---

### Issue #4 (Account Lockout) - MEDIUM-HIGH RISK
**Risk**: Locking out legitimate users incorrectly
**Blast Radius**: All user accounts, authentication system
**Mitigation**:
- Redis with proper TTL (auto-unlock after timeout)
- Admin unlock endpoint from day 1
- Email notifications for transparency
- Conservative rate limit (5 attempts / 15min)

**Rollback**: Disable middleware, flush Redis lockout keys

---

### Issue #19 (Retry Logic) - LOW RISK
**Risk**: Infinite retry loops on persistent errors
**Blast Radius**: API load (could amplify issues)
**Mitigation**:
- Max 3 retries (1s, 2s, 4s = 7s total)
- Don't retry 4xx (except 429)
- Circuit breaker pattern if needed

**Rollback**: Remove retry wrapper from hooks

---

### Overall Sprint Risk: MEDIUM
- Multiple auth system changes
- Requires careful testing before production
- **Recommendation**: Deploy to staging first, monitor for 24 hours

---

## Agent Deployment Plan

### Available Agents
From `.claude/Agents.md`:
- **typescript-pro**: TypeScript/React implementation
- **test-writer**: Test suite development
- **code-reviewer**: Code quality review
- **security-auditor**: Security vulnerability check
- **architect**: System design

### Available MCP Tools
- **playwright**: Visual verification, E2E testing, screenshots
- **chrome**: Browser automation
- **ast-grep**: Code search and refactoring
- **code-index**: Codebase analysis
- **sequential-thinking**: Planning (already used)

---

### Batch 1: Foundation (Sequential)

**Agent 1: typescript-pro + architect**
- **Task**: Implement AuthContext (#17)
- **Files**:
  - `apps/web/src/contexts/AuthContext.tsx` (~150 LOC)
  - `apps/web/src/hooks/useAuth.ts` (~50 LOC)
  - `apps/web/src/components/ProtectedRoute.tsx` (~80 LOC)
  - `apps/web/src/__tests__/contexts/auth.test.tsx` (~400 LOC, 25 tests)
- **Tools**: ast-grep (pattern analysis), playwright (verification)
- **Deliverables**: 300-400 LOC + 25 tests + 4 screenshots

---

### Batch 2: Features (Parallel - after Batch 1)

**Agent 2: typescript-pro + security-auditor**
- **Task**: Account Lockout Backend (#4)
- **Files**:
  - `apps/api/src/middleware/account-lockout.ts` (~200 LOC)
  - `apps/api/src/services/lockout-tracker.ts` (~150 LOC)
  - `apps/api/src/services/email/lockout-notification.ts` (~100 LOC)
  - `apps/api/src/routes/admin/unlock-account.ts` (~80 LOC)
  - `apps/api/src/__tests__/auth/lockout.test.ts` (~500 LOC, 20 tests)
- **Tools**: code-index (Redis patterns), playwright (manual lockout testing)
- **Deliverables**: 530 LOC + 500 LOC tests + 3 screenshots

**Agent 3: typescript-pro + test-writer**
- **Task**: Retry Logic (#19)
- **Files**:
  - `apps/web/src/hooks/useRetry.ts` (~120 LOC)
  - Modify: `useBills.ts`, `useLegislators.ts`, `useVotes.ts`
  - `apps/web/src/__tests__/hooks/useRetry.test.tsx` (~300 LOC, 15 tests)
- **Tools**: ast-grep (modify all hooks), playwright (failure scenarios)
- **Deliverables**: 120 LOC + hook modifications + 300 LOC tests + 3 screenshots

---

### Post-Implementation

**Agent 4: code-reviewer**
- **Task**: Review all three implementations
- **Focus**:
  - Security audit for lockout mechanism
  - Performance check for retry logic
  - Code quality across all implementations
- **Deliverables**: Review report with fixes applied

---

## Acceptance Criteria & Deliverables

### Issue #17 (AuthContext)

**Deliverables**:
- ✅ `apps/web/src/contexts/AuthContext.tsx` (~150 LOC)
- ✅ `apps/web/src/hooks/useAuth.ts` (~50 LOC)
- ✅ `apps/web/src/components/ProtectedRoute.tsx` (~80 LOC)
- ✅ `apps/web/src/__tests__/contexts/auth.test.tsx` (~400 LOC, 25 tests)
- ✅ Documentation: Update CLAUDE.md with auth pattern

**Acceptance Criteria**:
- ✅ AuthContext provides login/logout/session state
- ✅ useAuth hook for component consumption
- ✅ Protected route wrapper component
- ✅ Session persistence in localStorage
- ✅ Automatic token refresh on expiry
- ✅ Loading states during auth operations
- ✅ 25+ tests covering all scenarios
- ✅ 4 Playwright verification screenshots

---

### Issue #4 (Account Lockout)

**Deliverables**:
- ✅ `apps/api/src/middleware/account-lockout.ts` (~200 LOC)
- ✅ `apps/api/src/services/lockout-tracker.ts` (~150 LOC)
- ✅ `apps/api/src/services/email/lockout-notification.ts` (~100 LOC)
- ✅ `apps/api/src/routes/admin/unlock-account.ts` (~80 LOC)
- ✅ `apps/api/src/__tests__/auth/lockout.test.ts` (~500 LOC, 20 tests)
- ✅ Documentation: Update SECURITY.md with lockout mechanism

**Acceptance Criteria**:
- ✅ Track failed attempts in Redis (5 per 15min window)
- ✅ Exponential backoff: 15min, 30min, 1hr, 4hr, 24hr
- ✅ Email notification on lockout
- ✅ Admin unlock endpoint with auth
- ✅ 20 integration tests
- ✅ Performance: <5ms Redis lookup
- ✅ 3 Playwright verification screenshots

---

### Issue #19 (Retry Logic)

**Deliverables**:
- ✅ `apps/web/src/hooks/useRetry.ts` (~120 LOC)
- ✅ Modify existing hooks: `useBills.ts`, `useLegislators.ts`, `useVotes.ts`
- ✅ `apps/web/src/__tests__/hooks/useRetry.test.tsx` (~300 LOC, 15 tests)
- ✅ Documentation: Update CLAUDE.md with retry pattern

**Acceptance Criteria**:
- ✅ Exponential backoff (1s, 2s, 4s)
- ✅ Max 3 retries
- ✅ Skip retry on 4xx (except 429)
- ✅ Integrated in useBills, useLegislators, useVotes
- ✅ 15 hook tests
- ✅ Loading states during retries
- ✅ 3 Playwright verification screenshots

---

## Testing & Verification Strategy

### Test Coverage Requirements
**ODIN Quality Gate**: ≥70% coverage on critical paths

**Total New Tests**: 60 tests
- Issue #17 (AuthContext): 25 tests
- Issue #4 (Account Lockout): 20 tests
- Issue #19 (Retry Logic): 15 tests

**Current Test Suite**: 477 tests passing (100%)
**Target Test Suite**: 537+ tests passing (100%)

---

### Issue #17 (AuthContext) - 25 tests

**Unit Tests: AuthContext Provider (8 tests)**
- Login flow with valid credentials
- Login flow with invalid credentials
- Logout clears state
- Session persistence on reload
- Token refresh on expiry
- Loading states
- Error states
- Multiple simultaneous requests

**Integration Tests: useAuth Hook (10 tests)**
- Hook provides correct auth state
- Login updates state
- Logout clears state
- Protected routes redirect unauthenticated users
- Token refresh works

**Component Tests: ProtectedRoute (7 tests)**
- Renders children when authenticated
- Redirects when not authenticated
- Shows loading state during auth check
- Handles expired tokens

---

### Issue #4 (Account Lockout) - 20 tests

**Unit Tests: lockout-tracker Service (8 tests)**
- Record failed attempt increments counter
- 5 attempts triggers lockout
- TTL set correctly for each level
- Clear lockout works
- Get lockout status accurate

**Integration Tests: Middleware (12 tests)**
- 1-4 failed attempts pass through
- 5th attempt returns HTTP 429
- Lockout persists for duration
- Admin unlock clears lockout
- Email sent on lockout
- Exponential backoff levels work

---

### Issue #19 (Retry Logic) - 15 tests

**Unit Tests: useRetry Hook (10 tests)**
- Retry on network error (3 attempts)
- Don't retry on 4xx (except 429)
- Retry on 429 with backoff
- Exponential delays (1s, 2s, 4s)
- Max 3 retries enforced
- Success on 2nd attempt works

**Integration Tests: Modified Hooks (5 tests)**
- useBills retries on failure
- useLegislators retries on failure
- useVotes retries on failure

---

### Visual Verification (Playwright)

**Total Screenshots**: 10

**AuthContext (4 scenarios)**:
1. Login flow successful
2. Login flow failure (invalid credentials)
3. Logout clears state
4. Protected route redirect

**Account Lockout (3 scenarios)**:
5. Manual lockout trigger (5 failed attempts)
6. Lockout message displayed
7. Email notification screenshot

**Retry Logic (3 scenarios)**:
8. Network failure with retry UI states
9. Successful retry on 2nd attempt
10. Max retries exceeded error

---

## Phase Breakdown

### Phase 1: Foundation (Sequential) - 6-8 hours

**Agent 1: typescript-pro (AuthContext #17)**

**Tasks**:
1. Design: AuthContext architecture (1h)
2. Implementation: Context + useAuth + ProtectedRoute (3h)
3. Tests: 25 comprehensive tests (2h)
4. Visual Verification: 4 Playwright screenshots (0.5h)
5. Documentation: CLAUDE.md updates (0.5h)

**Quality Gate**: All tests passing, screenshots captured

---

### Phase 2: Parallel Features (Concurrent) - 4-6 hours

**Agent 2: typescript-pro + security-auditor (Account Lockout #4)**

**Tasks**:
1. Design: Lockout architecture + Redis schema (1h)
2. Implementation: Middleware + Services + Admin endpoint (2h)
3. Tests: 20 integration tests (1.5h)
4. Visual Verification: 3 Playwright screenshots (0.5h)
5. Security Audit: Vulnerability scan (0.5h)

**Agent 3: typescript-pro + test-writer (Retry Logic #19)**

**Tasks**:
1. Design: Retry hook architecture (0.5h)
2. Implementation: useRetry + modify hooks (1.5h)
3. Tests: 15 hook tests (1.5h)
4. Visual Verification: 3 Playwright screenshots (0.5h)

---

### Phase 3: Integration & QC (Sequential) - 2-3 hours

**Agent 4: code-reviewer (All implementations)**

**Tasks**:
1. Code review findings (1h)
2. Apply fixes (1h)
3. Final verification (0.5h)

**Quality Checks**:
- Full test suite: `pnpm test` (verify 537+ tests passing)
- Build verification: `pnpm build`
- TypeScript: `pnpm typecheck` (zero errors)
- Visual regression: 10 screenshots captured

---

### Phase 4: Documentation & Closure (Sequential) - 1-2 hours

**Tasks**:
1. Create CR-2026-02-02-001 change record (0.5h)
2. Update CLAUDE.md, SECURITY.md (0.5h)
3. Create PR with comprehensive description (0.5h)
4. Close GitHub issues #17, #4, #19 (0.25h)
5. Commit with atomic strategy (0.25h)

---

## Change Control

### Change Record: CR-2026-02-02-001

**Category**: Category 1 (Major Changes - Architectural)
**Title**: "Security & Reliability Sprint - Auth Enhancement"

**Scope**:
- Issue #17: Centralized Authentication State Management
- Issue #4: Account Lockout Protection (CVSS 7.5)
- Issue #19: Retry Logic with Exponential Backoff

**Files Modified/Created**: ~15 files
- 3 new React contexts/hooks
- 4 new API services/middleware
- 1 new admin endpoint
- 7 test files
- Documentation updates

**Lines of Code**: ~2,200 LOC (including 1,400 LOC tests)

**Breaking Changes**: NONE
- AuthContext is additive (existing auth still works)
- Account lockout is new middleware (doesn't break existing)
- Retry logic wraps existing hooks (transparent to consumers)

---

### Rollback Plan

1. **Disable account-lockout middleware** in API
2. **Flush Redis lockout keys**: `redis-cli FLUSHDB`
3. **Remove AuthContext provider** from `_app.tsx` (revert to component auth)
4. **Remove retry wrapper** from hooks

**Rollback Time**: <15 minutes
**Risk**: LOW (all changes are additive)

---

### Documentation Updates

1. **CLAUDE.md**: Add AuthContext usage pattern
2. **apps/web/SECURITY.md**: Document lockout mechanism
3. **apps/api/README.md**: Document admin unlock endpoint
4. **Create**: `docs/change-control/CR-2026-02-02-001.md`

---

### GitHub Updates

1. **Close issues**: #17, #4, #19 with PR reference
2. **Create PR** with comprehensive description
3. **Link** to change control record
4. **Add label**: "security enhancement"

---

## Success Metrics

### ODIN Quality Gates

| Gate | Target | Expected | Status |
|------|--------|----------|--------|
| **Functional Accuracy** | ≥95% | 100% | ⏳ PENDING |
| **Code Quality** | ≥90% | 95% | ⏳ PENDING |
| **Security Compliance** | 100% | 100% | ⏳ PENDING |
| **Test Coverage** | ≥70% | 100% (537/537) | ⏳ PENDING |
| **Documentation Accuracy** | ≥90% | 100% | ⏳ PENDING |

---

### Sprint Success Criteria

- ✅ 60 new tests added (total: 537+ tests)
- ✅ 10 verification screenshots captured
- ✅ Security CVSS 7.5 vulnerability resolved
- ✅ Zero regressions (all existing tests pass)
- ✅ All builds successful (API, Web, Shared)
- ✅ TypeScript: Zero compilation errors
- ✅ Change control record created
- ✅ GitHub issues closed with evidence

---

## Timeline & Effort

### Detailed Effort Breakdown

| Phase | Effort | Activities |
|-------|--------|------------|
| **Phase 1: Foundation** | 6-8h | AuthContext implementation, tests, screenshots |
| **Phase 2: Parallel Features** | 4-6h | Account Lockout + Retry Logic (concurrent) |
| **Phase 3: Integration & QC** | 2-3h | Code review, fixes, verification |
| **Phase 4: Documentation** | 1-2h | Change control, PR, GitHub updates |
| **Total** | **13-19h** | **Realistic: 15h** |

---

### Timeline Projection

**With Parallelization**: 2-3 working days
- Day 1: Phase 1 (Foundation) - 6-8h
- Day 2: Phase 2 (Parallel) + Phase 3 (QC) - 6-9h
- Day 3: Phase 4 (Documentation) - 1-2h

**Without Parallelization**: 3-4 working days
- Savings: 1 day (25% faster)

---

## Appendix: File Inventory

### Files Created (15 files)

**Frontend (Apps/Web)**:
1. `apps/web/src/contexts/AuthContext.tsx` (~150 LOC)
2. `apps/web/src/hooks/useAuth.ts` (~50 LOC)
3. `apps/web/src/components/ProtectedRoute.tsx` (~80 LOC)
4. `apps/web/src/hooks/useRetry.ts` (~120 LOC)
5. `apps/web/src/__tests__/contexts/auth.test.tsx` (~400 LOC, 25 tests)
6. `apps/web/src/__tests__/hooks/useRetry.test.tsx` (~300 LOC, 15 tests)

**Backend (Apps/API)**:
7. `apps/api/src/middleware/account-lockout.ts` (~200 LOC)
8. `apps/api/src/services/lockout-tracker.ts` (~150 LOC)
9. `apps/api/src/services/email/lockout-notification.ts` (~100 LOC)
10. `apps/api/src/routes/admin/unlock-account.ts` (~80 LOC)
11. `apps/api/src/__tests__/auth/lockout.test.ts` (~500 LOC, 20 tests)

**Documentation**:
12. `docs/change-control/CR-2026-02-02-001.md`
13. `docs/plans/2026-02-02-security-reliability-sprint.md` (this file)
14. Updated: `CLAUDE.md`
15. Updated: `apps/web/SECURITY.md`

---

### Files Modified (3 files)

1. `apps/web/src/hooks/useBills.ts` (add retry wrapper)
2. `apps/web/src/hooks/useLegislators.ts` (add retry wrapper)
3. `apps/web/src/hooks/useVotes.ts` (add retry wrapper)

---

### Screenshot Inventory (10 screenshots)

**AuthContext**:
1. `docs/screenshots/auth-context-01-login-success.png`
2. `docs/screenshots/auth-context-02-login-failure.png`
3. `docs/screenshots/auth-context-03-logout.png`
4. `docs/screenshots/auth-context-04-protected-route.png`

**Account Lockout**:
5. `docs/screenshots/lockout-01-manual-trigger.png`
6. `docs/screenshots/lockout-02-lockout-message.png`
7. `docs/screenshots/lockout-03-email-notification.png`

**Retry Logic**:
8. `docs/screenshots/retry-01-network-failure.png`
9. `docs/screenshots/retry-02-successful-retry.png`
10. `docs/screenshots/retry-03-max-retries.png`

---

## Next Steps

1. ✅ Planning document created
2. ⏳ Begin Phase 1: Implement AuthContext (#17)
3. ⏳ Deploy parallel agents for Phases 2-3
4. ⏳ Complete verification and documentation
5. ⏳ Create PR and close GitHub issues

---

**Plan Created**: 2026-02-02
**Method**: ODIN with sequential-thinking
**Status**: ✅ COMPLETE - Ready for execution
**Next Action**: Launch Phase 1 Agent (typescript-pro for AuthContext)
