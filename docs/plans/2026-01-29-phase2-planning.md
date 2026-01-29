# Phase 2 Planning Document

**Document Version**: 1.0.0
**Created**: 2026-01-29
**Methodology**: ODIN (Outline Driven INtelligence)
**Author**: ODIN Code Agent

---

## Executive Summary

Phase 1 MVP is **100% COMPLETE**. Phase 2 focuses on:
1. **Production Readiness** - Historical data load, security hardening, performance validation
2. **Quality Assurance** - Frontend test coverage, type safety improvements
3. **Enhanced Features** - ML pipeline integration, advanced analytics

**Target**: Production-ready platform with real congressional data

---

## Phase 2 Work Package Overview

| Work Package | Priority | Effort | Dependencies | Status |
|--------------|----------|--------|--------------|--------|
| WP8 - Historical Data Execution | CRITICAL | 2-3 days | WP7-A complete | PENDING |
| WP9 - Frontend Testing | HIGH | 2-3 days | WP6-R complete | PENDING |
| WP10 - Security Hardening | HIGH | 1-2 days | WP4, WP6-R complete | PENDING |
| WP11 - Performance Validation | MEDIUM | 1-2 days | WP8 complete | PENDING |
| WP12 - Type Safety Improvements | MEDIUM | 1 day | WP6-R complete | PENDING |
| WP13 - ML Pipeline Foundation | LOW | 3-5 days | WP8 complete | PENDING |

---

## WP8 - Historical Data Execution

### Overview
Execute the bulk import system (built in WP7-A) to load real congressional data from Congress.gov API.

### Acceptance Criteria
- [ ] Congress 118 data fully imported (legislators, committees, bills, votes)
- [ ] Congress 119 data fully imported
- [ ] Validation report shows >99% data integrity
- [ ] Search returns real legislative data
- [ ] Resumability tested with artificial interruption

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP8-D1 | Legislators imported (535+ current) | Yes | `SELECT COUNT(*) FROM legislators WHERE in_office = true` |
| WP8-D2 | Committees imported (all standing) | Yes | `SELECT COUNT(*) FROM committees` |
| WP8-D3 | Bills imported (Congress 118-119) | Yes | `SELECT COUNT(*) FROM bills` |
| WP8-D4 | Votes imported (roll calls) | Yes | `SELECT COUNT(*) FROM votes` |
| WP8-D5 | Validation report generated | Yes | File exists: `import-validation-report.json` |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Configure production API key | 0.5h | Low |
| T2 | Run legislators phase | 2h | Medium |
| T3 | Run committees phase | 1h | Low |
| T4 | Run bills phase (Congress 118) | 4-8h | High |
| T5 | Run bills phase (Congress 119) | 4-8h | High |
| T6 | Run votes phase | 2-4h | Medium |
| T7 | Run validation phase | 1h | Low |
| T8 | Generate import report | 0.5h | Low |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limiting | High | Medium | Use off-peak hours, exponential backoff |
| Data volume overwhelming | Medium | High | Batch processing, checkpointing |
| Network failures | Medium | Medium | Resumable imports from checkpoint |
| API format changes | Low | High | Adapter pattern, schema validation |

### Dependencies
- WP7-A Historical Data Load infrastructure (COMPLETE)
- Congress.gov API key with sufficient quota
- Database with adequate storage (~5GB estimated)

### Effort Estimate
- **Optimistic**: 1.5 days
- **Expected**: 2.5 days
- **Pessimistic**: 4 days (if rate limiting aggressive)

---

## WP9 - Frontend Testing

### Overview
Address the critical gap of 0% frontend test coverage. Establish testing infrastructure and achieve 50%+ coverage.

### Acceptance Criteria
- [ ] Vitest configured for Next.js frontend
- [ ] React Testing Library installed and configured
- [ ] Hook tests written (useBills, useLegislators, useVotes, useDebounce)
- [ ] Component tests written (common components, page components)
- [ ] Test coverage report shows >50% statement coverage
- [ ] CI pipeline updated to run frontend tests

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP9-D1 | Vitest configuration | Yes | `pnpm --filter @ltip/web test` passes |
| WP9-D2 | useBills hook tests | Yes | 10+ tests covering all states |
| WP9-D3 | useLegislators hook tests | Yes | 10+ tests covering all states |
| WP9-D4 | useVotes hook tests | Yes | 10+ tests covering all states |
| WP9-D5 | useDebounce hook tests | Yes | 5+ tests covering timing |
| WP9-D6 | Common component tests | Yes | ErrorBoundary, LoadingState, EmptyState, Pagination |
| WP9-D7 | Page component tests | Yes | BillsPageClient, LegislatorsPageClient smoke tests |
| WP9-D8 | Coverage report | Yes | `coverage/lcov-report/index.html` shows >50% |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Install Vitest + RTL + MSW | 1h | Low |
| T2 | Configure Vitest for Next.js | 2h | Medium |
| T3 | Create test utilities and mocks | 2h | Low |
| T4 | Write useDebounce tests | 1h | Low |
| T5 | Write useBills tests | 3h | Medium |
| T6 | Write useLegislators tests | 2h | Medium |
| T7 | Write useVotes tests | 2h | Medium |
| T8 | Write common component tests | 3h | Low |
| T9 | Write page component smoke tests | 4h | Medium |
| T10 | Configure coverage reporting | 1h | Low |
| T11 | Update CI pipeline | 1h | Low |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Next.js SSR complexity | Medium | Medium | Use RTL with proper providers |
| Mock API complexity | Medium | Low | Use MSW for API mocking |
| Test flakiness | Low | Medium | Proper async handling |

### Dependencies
- WP6-R Frontend MVP (COMPLETE)
- Node.js test runner compatibility

### Effort Estimate
- **Optimistic**: 2 days
- **Expected**: 3 days
- **Pessimistic**: 4 days

---

## WP10 - Security Hardening

### Overview
Address security findings from QC review: CSP headers, route parameter validation, input sanitization.

### Acceptance Criteria
- [ ] Content Security Policy (CSP) headers configured
- [ ] All route parameters validated with Zod
- [ ] API response headers include security headers
- [ ] No XSS vectors in dynamic content
- [ ] Security audit score improves to 9+/10

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP10-D1 | CSP headers in next.config.js | Yes | Browser devtools shows CSP header |
| WP10-D2 | Route param validation (bills) | Yes | Invalid IDs return 400 |
| WP10-D3 | Route param validation (legislators) | Yes | Invalid IDs return 400 |
| WP10-D4 | API security headers | Yes | X-Content-Type-Options, X-Frame-Options |
| WP10-D5 | Security audit report | Yes | Score >9/10 |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Configure CSP headers | 2h | Medium |
| T2 | Create Zod schemas for route params | 1h | Low |
| T3 | Implement validation middleware | 2h | Low |
| T4 | Add API security headers | 1h | Low |
| T5 | Run security audit | 1h | Low |
| T6 | Fix any remaining findings | 2-4h | Medium |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CSP breaks functionality | Medium | Medium | Test thoroughly, use report-only first |
| Overly strict validation | Low | Low | Comprehensive regex patterns |

### Dependencies
- WP4 Core REST API (COMPLETE)
- WP6-R Frontend MVP (COMPLETE)

### Effort Estimate
- **Optimistic**: 1 day
- **Expected**: 1.5 days
- **Pessimistic**: 2 days

---

## WP11 - Performance Validation

### Overview
Validate Phase 1 exit criteria for API response time (<200ms p95) and WebSocket latency (<100ms).

### Acceptance Criteria
- [ ] Load testing framework configured
- [ ] API endpoints benchmarked under load
- [ ] p95 response time <200ms for all endpoints
- [ ] WebSocket message latency <100ms
- [ ] Performance baseline documented
- [ ] Bottlenecks identified and documented

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP11-D1 | k6 load testing scripts | Yes | Scripts run without error |
| WP11-D2 | API performance report | Yes | JSON report with p50/p95/p99 |
| WP11-D3 | WebSocket latency report | Yes | Latency measurements documented |
| WP11-D4 | Performance baseline document | Yes | Markdown document with metrics |
| WP11-D5 | Bottleneck analysis | Yes | Identified issues documented |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Install k6 load testing tool | 0.5h | Low |
| T2 | Write API load test scripts | 2h | Low |
| T3 | Write WebSocket load test scripts | 2h | Medium |
| T4 | Run baseline tests | 2h | Low |
| T5 | Analyze results | 2h | Low |
| T6 | Document findings | 1h | Low |
| T7 | Optimize if needed | 2-8h | Medium |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance below target | Medium | High | Query optimization, caching |
| Test environment differs from prod | Medium | Medium | Use realistic data volumes |

### Dependencies
- WP8 Historical Data Execution (for realistic data)
- Database with production-like data volume

### Effort Estimate
- **Optimistic**: 1 day
- **Expected**: 2 days
- **Pessimistic**: 3 days (if optimization needed)

---

## WP12 - Type Safety Improvements

### Overview
Address TypeScript QC findings: discriminated unions, type guards, non-null assertions.

### Acceptance Criteria
- [ ] Discriminated unions for async states (loading/error/success)
- [ ] Type guards for API responses
- [ ] Non-null assertions replaced with proper checks
- [ ] No `any` types in production code
- [ ] TypeScript strict mode passes

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP12-D1 | AsyncState discriminated union | Yes | Compile-time exhaustiveness check |
| WP12-D2 | API response type guards | Yes | Runtime type validation |
| WP12-D3 | Removed non-null assertions | Yes | No `!` operators in code |
| WP12-D4 | Explicit error types | Yes | Error handling type-safe |
| WP12-D5 | Clean typecheck | Yes | `pnpm run typecheck` passes |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Define AsyncState union type | 1h | Low |
| T2 | Refactor hooks to use discriminated unions | 2h | Medium |
| T3 | Add Zod runtime validation for API responses | 2h | Low |
| T4 | Replace non-null assertions | 1h | Low |
| T5 | Add explicit error types | 1h | Low |
| T6 | Final typecheck verification | 0.5h | Low |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking changes | Low | Medium | Incremental refactoring |
| Type complexity | Low | Low | Keep types simple |

### Dependencies
- WP6-R Frontend MVP (COMPLETE)

### Effort Estimate
- **Optimistic**: 0.5 days
- **Expected**: 1 day
- **Pessimistic**: 1.5 days

---

## WP13 - ML Pipeline Foundation (Optional)

### Overview
Establish foundation for ML-powered features: bias scoring, voting pattern analysis, legislator similarity.

### Acceptance Criteria
- [ ] ML pipeline architecture designed
- [ ] Feature extraction for bills implemented
- [ ] Basic bias scoring model integrated
- [ ] API endpoints for ML predictions
- [ ] Documentation for ML pipeline

### Deliverables
| ID | Deliverable | Testable | Verification |
|----|-------------|----------|--------------|
| WP13-D1 | ML pipeline architecture doc | Yes | Diagram and specification |
| WP13-D2 | Feature extraction service | Yes | Extracts features from bill text |
| WP13-D3 | Bias scoring endpoint | Yes | `/api/v1/ml/bias-score` |
| WP13-D4 | Model serving infrastructure | Yes | Model loads and predicts |
| WP13-D5 | Integration tests | Yes | End-to-end prediction works |

### Tasks
| Task | Description | Effort | Risk |
|------|-------------|--------|------|
| T1 | Design ML pipeline architecture | 4h | Medium |
| T2 | Set up ML service infrastructure | 4h | Medium |
| T3 | Implement feature extraction | 8h | High |
| T4 | Integrate bias scoring model | 8h | High |
| T5 | Create API endpoints | 4h | Medium |
| T6 | Write integration tests | 4h | Low |
| T7 | Document pipeline | 2h | Low |

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Model accuracy insufficient | Medium | High | Multiple model approaches |
| Performance overhead | Medium | Medium | Async processing, caching |
| Data quality issues | Medium | Medium | Validation and preprocessing |

### Dependencies
- WP8 Historical Data Execution
- ML model training data

### Effort Estimate
- **Optimistic**: 3 days
- **Expected**: 5 days
- **Pessimistic**: 7 days

---

## Phase 2 Execution Plan

### Recommended Order

```
Week 1:
├── WP8: Historical Data Execution (CRITICAL)
│   ├── Day 1-2: Legislators, Committees, Bills
│   └── Day 3: Votes, Validation
└── WP10: Security Hardening (parallel)
    └── Day 2-3: CSP, validation, headers

Week 2:
├── WP9: Frontend Testing
│   ├── Day 1: Setup, hooks tests
│   └── Day 2-3: Component tests, CI
├── WP11: Performance Validation (after WP8)
│   └── Day 2-3: Load testing, analysis
└── WP12: Type Safety (parallel)
    └── Day 1: Type improvements

Week 3 (Optional):
└── WP13: ML Pipeline Foundation
    └── Day 1-5: Architecture, implementation
```

### Critical Path

```
WP8 (Data) → WP11 (Performance) → WP13 (ML)
     ↓
WP9 (Tests) parallel WP10 (Security) parallel WP12 (Types)
```

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data completeness | >99% | Validation report |
| Frontend test coverage | >50% | Coverage report |
| API p95 latency | <200ms | k6 load test |
| WebSocket latency | <100ms | Load test |
| Security score | >9/10 | Security audit |
| Type safety | 100% strict | TypeScript compiler |

---

## QC Findings from Phase 1 (Addressed in Phase 2)

| Agent | Score | Findings | Phase 2 Work Package |
|-------|-------|----------|---------------------|
| Code Reviewer | 7.5/10 | Type assertions, code duplication | WP12 |
| Security Auditor | 7.2/10 | Missing CSP, unvalidated params | WP10 |
| TypeScript Pro | 7.5/10 | Non-null assertions, missing unions | WP12 |
| Test Writer | N/A | 0% frontend coverage | WP9 |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-29 | ODIN | Initial Phase 2 planning |

---

**Document End**
