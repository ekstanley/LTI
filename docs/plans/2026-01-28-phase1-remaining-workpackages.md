# Phase 1 Remaining Work Packages

**Document Version**: 1.0.0
**Created**: 2026-01-28
**Methodology**: ODIN (Outline Driven INtelligence)
**Status**: APPROVED FOR EXECUTION

---

## Overview

Three work packages remain to complete Phase 1 MVP:

| WP ID | Name | Effort | Priority | Dependencies |
|-------|------|--------|----------|--------------|
| WP6-R | Frontend Completion | 2-3 days | HIGH | None |
| WP3-A | Data Ingestion Core | 3-4 days | CRITICAL | None |
| WP7-A | Historical Data Load | 2-3 days | HIGH | WP3-A |

**Total Estimated Effort**: 7-10 days

---

## WP6-R: Frontend Completion

### Objective
Connect existing frontend scaffold to live API and add missing pages.

### Acceptance Criteria

| ID | Criterion | Testable Metric |
|----|-----------|-----------------|
| AC-6R-1 | Bills page fetches real data from API | Network tab shows `/api/v1/bills` calls |
| AC-6R-2 | Bills page pagination works | URL updates with `offset`, data changes |
| AC-6R-3 | Bills page filters work | Chamber/status filters update API params |
| AC-6R-4 | Bills page search works | Search input triggers API search |
| AC-6R-5 | Bill detail page renders | `/bills/:id` shows bill data |
| AC-6R-6 | Legislators list page renders | `/legislators` shows paginated list |
| AC-6R-7 | Legislator detail page renders | `/legislators/:id` shows stats |
| AC-6R-8 | Loading states display | Skeleton/spinner during fetches |
| AC-6R-9 | Error states handle gracefully | API errors show user-friendly messages |
| AC-6R-10 | Mobile responsive | Pages usable on 375px viewport |

### Deliverables

```
apps/web/src/
├── app/
│   ├── bills/
│   │   ├── page.tsx              [MODIFY] - Connect to API
│   │   └── [id]/page.tsx         [CREATE] - Bill detail page
│   ├── legislators/
│   │   ├── page.tsx              [CREATE] - Legislators list
│   │   └── [id]/page.tsx         [CREATE] - Legislator detail
│   └── votes/
│       └── page.tsx              [CREATE] - Live votes page
├── components/
│   ├── common/
│   │   ├── Pagination.tsx        [CREATE]
│   │   ├── SearchInput.tsx       [CREATE]
│   │   ├── FilterSelect.tsx      [CREATE]
│   │   └── ErrorBoundary.tsx     [CREATE]
│   └── legislators/
│       ├── LegislatorCard.tsx    [CREATE]
│       └── index.ts              [CREATE]
└── hooks/
    ├── useBills.ts               [CREATE] - SWR hook for bills
    ├── useLegislators.ts         [CREATE] - SWR hook for legislators
    └── useVotes.ts               [CREATE] - SWR hook for votes
```

### Dependencies
- None (can use existing seed data for development)

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SWR caching issues | Low | Low | Configure staleTime appropriately |
| Type mismatches | Medium | Low | Use shared types from @ltip/shared |
| Styling inconsistencies | Low | Low | Follow existing Tailwind patterns |

### Effort Estimate

| Task | Hours | Confidence |
|------|-------|------------|
| Bills page API connection | 2h | High |
| Bills page filters/search | 3h | High |
| Bill detail page | 3h | High |
| Legislators list page | 3h | High |
| Legislator detail page | 4h | Medium |
| Live votes page (basic) | 4h | Medium |
| Common components | 2h | High |
| SWR hooks | 2h | High |
| Error/loading states | 2h | High |
| Mobile polish | 2h | High |
| **Total** | **27h** | ~3 days |

### Test Plan

1. **Manual Testing**:
   - Navigate to each page
   - Verify data loads from API
   - Test pagination, filtering, search
   - Test error scenarios (API down)
   - Test responsive breakpoints

2. **Automated Testing** (optional for MVP):
   - Component unit tests with Vitest
   - E2E tests with Playwright (Phase 2)

---

## WP3-A: Data Ingestion Core

### Objective
Build Congress.gov API client with rate limiting, retry logic, and sync scheduler.

### Acceptance Criteria

| ID | Criterion | Testable Metric |
|----|-----------|-----------------|
| AC-3A-1 | Congress.gov client authenticates | API key validated, requests succeed |
| AC-3A-2 | Bills endpoint fetches data | Response parsed to Prisma format |
| AC-3A-3 | Legislators endpoint fetches data | Response parsed to Prisma format |
| AC-3A-4 | Votes endpoint fetches data | Response parsed to Prisma format |
| AC-3A-5 | Rate limiting respects API limits | Max 1000 requests/hour enforced |
| AC-3A-6 | Retry logic handles failures | 3 retries with exponential backoff |
| AC-3A-7 | Sync scheduler runs on interval | Bull/agenda job executes correctly |
| AC-3A-8 | Incremental sync supported | Only new/changed records fetched |
| AC-3A-9 | Error logging captures failures | Structured logs with context |
| AC-3A-10 | Unit tests pass | >80% coverage on client code |

### Deliverables

```
apps/api/src/
├── ingestion/
│   ├── index.ts                  [CREATE] - Module exports
│   ├── congress-client.ts        [CREATE] - Congress.gov API wrapper
│   ├── data-transformer.ts       [CREATE] - API to Prisma conversion
│   ├── rate-limiter.ts           [CREATE] - Request throttling
│   ├── retry-handler.ts          [CREATE] - Exponential backoff
│   ├── sync-scheduler.ts         [CREATE] - Cron/Bull job scheduling
│   └── types.ts                  [CREATE] - API response types
├── __tests__/ingestion/
│   ├── congress-client.test.ts   [CREATE]
│   ├── data-transformer.test.ts  [CREATE]
│   └── rate-limiter.test.ts      [CREATE]
└── lib/
    └── queue.ts                  [CREATE] - Bull queue setup (optional)
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Sync Scheduler                          │
│  (Cron: every 15min for recent, daily for historical)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Congress.gov Client                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rate Limiter │──│ HTTP Client  │──│ Retry Handler│      │
│  │ (1000/hour)  │  │   (fetch)    │  │ (3 retries)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Transformer                           │
│  Congress.gov JSON ──► Prisma Schema ──► Database           │
└─────────────────────────────────────────────────────────────┘
```

### Congress.gov API Endpoints

| Endpoint | Data | Priority |
|----------|------|----------|
| `/bill/{congress}` | Bill list | HIGH |
| `/bill/{congress}/{type}/{number}` | Bill detail | HIGH |
| `/member` | Legislators | HIGH |
| `/member/{bioguideId}` | Legislator detail | HIGH |
| `/committee` | Committees | MEDIUM |
| `/nomination` | Nominations | LOW (Phase 2) |

### Dependencies
- Congress.gov API key (from api.congress.gov)
- Bull queue (optional, can use node-cron initially)

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limits exceeded | High | Medium | Token bucket rate limiter |
| API format changes | Medium | High | Version detection, adapter pattern |
| Network failures | Medium | Low | Retry with exponential backoff |
| Data inconsistencies | Low | Medium | Validation before insert |

### Effort Estimate

| Task | Hours | Confidence |
|------|-------|------------|
| Congress.gov client setup | 4h | High |
| Bills endpoint integration | 4h | Medium |
| Legislators endpoint integration | 4h | Medium |
| Votes endpoint integration | 4h | Medium |
| Rate limiter implementation | 3h | High |
| Retry handler implementation | 2h | High |
| Data transformer (all entities) | 6h | Medium |
| Sync scheduler | 3h | High |
| Unit tests | 4h | High |
| Integration testing | 2h | Medium |
| **Total** | **36h** | ~4 days |

### Test Plan

1. **Unit Tests**:
   - Mock Congress.gov responses
   - Test transformation logic
   - Test rate limiter behavior
   - Test retry logic

2. **Integration Tests**:
   - Test against real API (limited)
   - Verify data saves to database
   - Test incremental sync

---

## WP7-A: Historical Data Load

### Objective
Load Congress 118-119 data (bills, legislators, votes) for MVP launch.

### Acceptance Criteria

| ID | Criterion | Testable Metric |
|----|-----------|-----------------|
| AC-7A-1 | 118th Congress bills loaded | Count matches Congress.gov total |
| AC-7A-2 | 119th Congress bills loaded | Count matches Congress.gov total |
| AC-7A-3 | All current legislators loaded | 535+ members present |
| AC-7A-4 | Committee structure loaded | All standing committees |
| AC-7A-5 | Roll call votes loaded (118th) | Vote records with positions |
| AC-7A-6 | Data validates against API | Random sample matches source |
| AC-7A-7 | Full-text search indexes built | Bills/legislators searchable |
| AC-7A-8 | Import is resumable | Checkpoint allows restart |
| AC-7A-9 | Import completes <4 hours | Time-bounded execution |
| AC-7A-10 | No duplicate records | Upsert logic verified |

### Deliverables

```
apps/api/
├── scripts/
│   ├── bulk-import.ts            [CREATE] - Main import script
│   ├── import-bills.ts           [CREATE] - Bills import logic
│   ├── import-legislators.ts     [CREATE] - Legislators import
│   ├── import-votes.ts           [CREATE] - Votes import
│   ├── import-committees.ts      [CREATE] - Committees import
│   └── validate-import.ts        [CREATE] - Post-import validation
├── prisma/
│   └── seed-historical.ts        [CREATE] - Historical data seeder
└── docs/
    └── data-import-runbook.md    [CREATE] - Operations guide
```

### Data Volume Estimates

| Entity | 118th Congress | 119th Congress | Total |
|--------|----------------|----------------|-------|
| Bills | ~15,000 | ~5,000 | ~20,000 |
| Legislators | ~540 | ~540 | ~540 (deduplicated) |
| Committees | ~250 | ~250 | ~250 |
| Roll Call Votes | ~1,500 | ~200 | ~1,700 |
| Individual Votes | ~750,000 | ~100,000 | ~850,000 |

### Import Strategy

```
Phase 1: Structural Data (Blocking)
├── Congress sessions (118, 119)
├── Committees and subcommittees
└── Legislators (all current + recent)

Phase 2: Bills (Parallelizable by congress)
├── 118th Congress bills (batch of 100)
└── 119th Congress bills (batch of 100)

Phase 3: Votes (Parallelizable by congress)
├── Roll call votes metadata
└── Individual vote positions

Phase 4: Validation
├── Count verification
├── Sample comparison
└── Search index rebuild
```

### Dependencies
- **WP3-A** (Data Ingestion Core) must be complete
- Congress.gov API key with sufficient quota
- Database with sufficient storage (~5GB estimated)

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API quota exhaustion | High | High | Off-peak hours, multi-day import |
| Import timeout | Medium | Medium | Checkpoint-based resumability |
| Data corruption | Low | High | Transaction batching, validation |
| Database performance | Medium | Medium | Batch inserts, index rebuild after |

### Effort Estimate

| Task | Hours | Confidence |
|------|-------|------------|
| Import scripts scaffolding | 3h | High |
| Bills import logic | 4h | Medium |
| Legislators import logic | 3h | High |
| Votes import logic | 5h | Medium |
| Committees import logic | 2h | High |
| Checkpoint/resume logic | 3h | Medium |
| Validation scripts | 2h | High |
| Documentation | 2h | High |
| Execution and monitoring | 4h | Medium |
| **Total** | **28h** | ~3 days |

### Test Plan

1. **Dry Run**:
   - Test with Congress 119 only (smaller dataset)
   - Verify counts and data quality
   - Measure execution time

2. **Production Run**:
   - Execute during off-peak hours
   - Monitor API rate limit usage
   - Verify checkpoints work

3. **Validation**:
   - Compare record counts
   - Spot-check random samples
   - Test search functionality

---

## Execution Schedule

### Recommended Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Day 1-2: WP6-R Frontend Completion (Can start immediately)      │
├─────────────────────────────────────────────────────────────────┤
│ Day 1-4: WP3-A Data Ingestion Core (Parallel with WP6-R)       │
├─────────────────────────────────────────────────────────────────┤
│ Day 5-7: WP7-A Historical Data Load (After WP3-A)              │
├─────────────────────────────────────────────────────────────────┤
│ Day 8: Integration Testing & QC                                 │
├─────────────────────────────────────────────────────────────────┤
│ Day 9-10: Documentation & Release Prep                          │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Path

```
WP6-R ──────────────────────────┐
                                 ├──► Phase 1 Complete
WP3-A ──► WP7-A ───────────────┘
```

WP6-R and WP3-A can run in parallel. WP7-A must wait for WP3-A.

---

## Quality Gates

### Before Phase 1 Release

| Gate | Requirement | Verification |
|------|-------------|--------------|
| Build | All packages build | `pnpm build` succeeds |
| Tests | >70% coverage, all pass | `pnpm test` green |
| Lint | No errors | `pnpm lint` clean |
| Types | Strict mode passes | `pnpm typecheck` clean |
| Data | 118th/119th Congress loaded | Count verification |
| API | <200ms p95 | Load test results |
| WebSocket | <100ms latency | Connection test |
| Frontend | 5 pages functional | Manual QA checklist |

---

## Resource Requirements

### Development
- 1 full-stack developer (7-10 days)
- OR 2 developers in parallel (4-5 days)

### Infrastructure
- Congress.gov API key (free, 1000 req/hour)
- PostgreSQL with ~5GB storage
- Redis for caching (optional)

### External Dependencies
- Congress.gov API availability
- Network connectivity

---

**Document End**
