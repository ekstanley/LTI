# Change Control Process

**Project**: LTIP (Legislative Tracking Intelligence Platform)
**Version**: 1.4.0
**Last Updated**: 2026-01-29

---

## Purpose

This document establishes the change control process for LTIP to ensure all modifications are properly evaluated, approved, documented, and tracked throughout the project lifecycle.

---

## Change Categories

### Category 1: Minor Changes (No Approval Required)
- Documentation updates
- Code style/formatting fixes
- Test additions without API changes
- Dependency patch updates
- Bug fixes that don't change behavior

**Process**: Direct commit to feature branch, standard PR review

### Category 2: Standard Changes (Team Approval)
- New features within approved scope
- API endpoint additions
- Database schema changes (additive)
- UI component additions
- Dependency minor version updates

**Process**: RFC discussion, team approval, PR with 2 reviewers

### Category 3: Major Changes (Architecture Review)
- Breaking API changes
- Database schema migrations (destructive)
- New external dependencies
- Infrastructure changes
- Security-related modifications

**Process**: Architecture review, RFC document, team vote, extended testing

### Category 4: Critical Changes (Stakeholder Approval)
- Scope changes
- Timeline adjustments
- Budget impacts
- Technology stack changes
- Third-party API replacements

**Process**: Change Request Form, stakeholder review, formal approval

---

## Change Request Process

### Step 1: Initiation

```markdown
## Change Request Form

**CR Number**: CR-YYYY-MM-DD-NNN
**Requestor**: [Name]
**Date**: [Date]
**Category**: [1/2/3/4]

### Description
[Detailed description of the proposed change]

### Justification
[Why is this change needed?]

### Impact Assessment
- **Scope Impact**: [None/Low/Medium/High]
- **Timeline Impact**: [None/Low/Medium/High]
- **Budget Impact**: [None/Low/Medium/High]
- **Risk Level**: [Low/Medium/High]

### Affected Components
- [ ] Frontend
- [ ] Backend API
- [ ] Database
- [ ] ML Pipeline
- [ ] Infrastructure
- [ ] Documentation

### Dependencies
[List any dependencies on other changes or external factors]

### Rollback Plan
[How to revert if the change fails]
```

### Step 2: Review

| Category | Review Board | SLA |
|----------|--------------|-----|
| 1 | Automated (CI/CD) | Immediate |
| 2 | Tech Lead | 2 business days |
| 3 | Architecture Team | 5 business days |
| 4 | Project Stakeholders | 10 business days |

### Step 3: Approval

**Approval Statuses**:
- **Approved**: Change can proceed
- **Approved with Conditions**: Change can proceed with modifications
- **Deferred**: Change postponed to future release
- **Rejected**: Change will not be implemented

### Step 4: Implementation

1. Create feature branch: `feature/CR-YYYY-MM-DD-NNN-description`
2. Implement change following coding standards
3. Write/update tests
4. Update documentation
5. Submit PR with CR reference

### Step 5: Verification

- [ ] All tests pass
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met

### Step 6: Closure

- Merge to main branch
- Update CHANGELOG.md
- Close Change Request
- Notify stakeholders

---

## Change Log Template

```markdown
## CR-YYYY-MM-DD-NNN: [Title]

**Status**: [Open/In Review/Approved/Implemented/Closed/Rejected]
**Category**: [1/2/3/4]
**Priority**: [Low/Medium/High/Critical]

### Timeline
- Requested: YYYY-MM-DD
- Reviewed: YYYY-MM-DD
- Approved: YYYY-MM-DD
- Implemented: YYYY-MM-DD
- Closed: YYYY-MM-DD

### Description
[Brief description]

### Implementation Notes
[Technical details of implementation]

### Verification Results
[Test results, benchmark data]
```

---

## Emergency Change Process

For critical production issues requiring immediate action:

1. **Identify**: Confirm severity (P1/P2 only)
2. **Communicate**: Alert on-call team via PagerDuty
3. **Implement**: Hotfix with minimal viable change
4. **Verify**: Smoke tests in staging, then production
5. **Document**: Retrospective within 24 hours
6. **Formalize**: Create CR post-facto

**Emergency Approvers**: CTO, Tech Lead, On-Call Engineer (any 2)

---

## Metrics and Reporting

### Change Metrics Tracked
- Change volume by category
- Lead time (request to implementation)
- Change failure rate
- Rollback frequency
- Time to resolution (for failures)

### Monthly Report
- Total changes by category
- Approval rate
- Average lead time
- Notable changes
- Lessons learned

---

## RACI Matrix

| Activity | Requestor | Tech Lead | Architect | PM | Stakeholder |
|----------|-----------|-----------|-----------|-----|-------------|
| Submit CR | R | I | I | I | I |
| Category 1 Review | A | R | - | - | - |
| Category 2 Review | C | R/A | I | I | - |
| Category 3 Review | C | R | R/A | I | I |
| Category 4 Review | C | C | C | R | A |
| Implementation | R | C | C | I | - |
| Verification | R | A | I | I | - |
| Closure | R | A | I | I | I |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## Change Freeze Periods

Changes restricted during:
- **Code Freeze**: 48 hours before major releases
- **Holiday Freeze**: Dec 20 - Jan 5 (emergency only)
- **Incident Response**: Active P1 incidents (emergency only)

---

## Appendix: Risk Assessment Matrix

| Probability | Impact: Low | Impact: Medium | Impact: High |
|-------------|-------------|----------------|--------------|
| Low | 1 (Accept) | 2 (Monitor) | 3 (Mitigate) |
| Medium | 2 (Monitor) | 4 (Mitigate) | 6 (Avoid) |
| High | 3 (Mitigate) | 6 (Avoid) | 9 (Escalate) |

---

## Active Change Log

### CR-2026-01-29-001: WP7-A Historical Data Load QC Fixes

**Status**: Implemented
**Category**: 2 (Standard Change)
**Priority**: High

#### Timeline
- Requested: 2026-01-29
- Reviewed: 2026-01-29
- Approved: 2026-01-29
- Implemented: 2026-01-29

#### Description
Quality control fixes for the WP7-A Historical Data Load system to address error handling issues discovered during testing.

#### Changes Implemented

| ID | Issue | Fix | Location |
|----|-------|-----|----------|
| WP7-A-001 | Offset leakage between phases | Reset offset to 0 when starting new phase | `import-votes.ts:listVotes()` |
| WP7-A-002 | 404 only detected at offset=0 | 404 detection at ANY offset breaks pagination | `import-votes.ts:254-260` |
| WP7-A-005 | Data loss on transient errors | Retry same offset, track consecutive errors | `import-votes.ts:262-275` |
| QC-001 | Infinite loop risk | Total error limit (100) stops import | `import-config.ts`, `import-votes.ts:277-286` |
| QC-003 | Stale compiled .js files | `scripts:clean` command, hooked into import scripts | `package.json` |
| QC-004 | Type assertion before validation | Type guard `isValidImportPhase()` for safe narrowing | `import-config.ts:265-267`, `bulk-import.ts:37,398-405` |
| SF-003 | Health check swallows errors silently | Log with category (rate_limited/auth/network/server) | `congress-client.ts:514-533` |

#### Affected Components
- [x] Backend API
- [x] Documentation
- [ ] Frontend
- [ ] Database
- [ ] ML Pipeline
- [ ] Infrastructure

#### Verification Results
- All 349 unit tests pass
- Dry-run completes successfully (5/5 phases)
- 404 detection verified at various offsets
- Stale file cleanup prevents infinite loop

#### Commits
- `5e6f36a` fix(api): add safeguard to clean stale compiled JS files before import
- `e3ba937` test(api): add behavior documentation tests for import error handling

---

### CR-2026-01-29-002: WP6-R Frontend Completion

**Status**: Implemented
**Category**: 2 (Standard Change)
**Priority**: High

#### Timeline
- Requested: 2026-01-29
- Reviewed: 2026-01-29
- Approved: 2026-01-29
- Implemented: 2026-01-29
- Closed: Pending (awaiting API integration test)

#### Description
Complete the WP6-R Frontend MVP work package to connect existing UI scaffolding to the real backend API. This is the final remaining work package for Phase 1 MVP completion.

#### Justification
Phase 1 is 91% complete. All backend infrastructure (WP1-WP5, WP7-A) is finished. WP6-R frontend completion is required to achieve Phase 1 MVP exit criteria.

#### Impact Assessment
- **Scope Impact**: None (within approved Phase 1 scope)
- **Timeline Impact**: Low (1-2 days estimated)
- **Budget Impact**: None
- **Risk Level**: Low

#### Affected Components
- [x] Frontend
- [ ] Backend API
- [ ] Database
- [ ] ML Pipeline
- [ ] Infrastructure
- [x] Documentation

#### Dependencies
- WP1-WP5 backend infrastructure (COMPLETE)
- WP7-A historical data load infrastructure (COMPLETE)
- Backend API endpoints operational

#### Deliverables

| ID | Deliverable | Status | Notes |
|----|-------------|--------|-------|
| WP6R-T1 | Project infrastructure | COMPLETE | `apps/web/src/hooks/` with barrel exports |
| WP6R-T2 | useBills hook | COMPLETE | SWR hook with pagination, filtering, search |
| WP6R-T3 | useLegislators hook | COMPLETE | SWR hook with search, party, state filters |
| WP6R-T4 | Bills page real API | COMPLETE | Connected to `/api/v1/bills` endpoint |
| WP6R-T5 | Bill detail page | STUB | Route `/bills/[id]` placeholder created |
| WP6R-T6 | Legislators list page | STUB | Route `/legislators` placeholder created |
| WP6R-T7 | Legislator detail page | STUB | Route `/legislators/[id]` placeholder created |
| WP6R-T8 | Live votes dashboard | STUB | Route `/votes` placeholder created |
| WP6R-T9 | Navigation component | COMPLETE | Global nav with active state indicators |
| WP6R-T10 | Integration testing | PARTIAL | Build passes, types verified, screenshot captured |

#### Implementation Details

**Hooks Infrastructure (`apps/web/src/hooks/`)**:
- `useBills.ts` - Fetches paginated bills with search/filter params
- `useLegislators.ts` - Fetches paginated legislators with search/filter params
- `useVotes.ts` - Fetches paginated votes with filter params
- `index.ts` - Barrel export for all hooks

**Type Fixes**:
- Fixed PaginatedResponse access pattern: `data?.pagination ?? null` instead of constructing from non-existent properties
- Fixed shared package ESM imports by removing `.js` extensions for `transpilePackages` compatibility

**Page Stubs Created** (for Next.js typedRoutes):
- `/app/legislators/page.tsx`
- `/app/legislators/[id]/page.tsx`
- `/app/bills/[id]/page.tsx`
- `/app/votes/page.tsx`
- `/app/about/page.tsx`
- `/app/privacy/page.tsx`

**Common UI Components** (`apps/web/src/components/common/`):
- `ErrorBoundary.tsx` - React error boundary with fallback UI
- `LoadingState.tsx` - Spinner with customizable message
- `EmptyState.tsx` - Empty state with icon and action button
- `Pagination.tsx` - Page navigation with prev/next buttons
- ErrorState integrated into BillsPageClient

#### Verification Results
- TypeScript: 0 errors
- Build: 9 routes generated successfully
- Server: Responds on port 3001
- Screenshot: Bills page with error state captured (API offline)
- Navigation: All links functional with active state

#### Rollback Plan
- Revert to mock data implementation if API integration fails
- Feature flags for gradual rollout if needed

#### Detailed Plan
See: `docs/plans/2026-01-29-wp6r-frontend-completion.md`

#### Remaining Work
- T5-T8: Implement full page content (currently stubs)
- Full integration test with live API

#### QC Findings (2026-01-29)

Four parallel QC agents reviewed the implementation:

| Agent | Score | Key Findings |
|-------|-------|--------------|
| Code Reviewer | 7.5/10 | SSR hydration issues, SWR type narrowing needed |
| Security Auditor | 7.5/10 | Missing CSP headers, unvalidated route params |
| TypeScript Pro | 8.5/10 | Good type coverage, minor improvements identified |
| Test Writer | N/A | **CRITICAL**: Zero frontend test coverage |

**Action Items**:
1. Add Vitest + React Testing Library for frontend tests
2. Validate route params with Zod schema
3. Configure CSP headers in next.config.js
4. Target 50% frontend coverage before Phase 1 closure

#### Commits
- `30e5b13` feat(web): implement WP6-R frontend infrastructure (T1-T4, T9)
- `4a864fa` docs: update gap analysis and change control with WP6-R QC findings

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.4.0 | 2026-01-29 | ODIN | Added QC findings and commit references to CR-2026-01-29-002 |
| 1.3.0 | 2026-01-29 | ODIN | Updated CR-2026-01-29-002: WP6R-T1 through T4 implemented |
| 1.2.0 | 2026-01-29 | ODIN | Added CR-2026-01-29-002 (WP6-R Frontend Completion) |
| 1.1.0 | 2026-01-29 | ODIN | Added CR-2026-01-29-001 (WP7-A QC Fixes) |
| 1.0.0 | 2026-01-28 | ODIN | Initial version |
