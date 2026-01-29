# WP7-A Historical Data Load - Execution Plan

**Document Version**: 1.0.0
**Created**: 2026-01-28
**Methodology**: ODIN (Outline Driven INtelligence)
**Status**: READY FOR EXECUTION
**Prerequisite**: WP3-A Data Ingestion Core (COMPLETE)

---

## Executive Summary

This work package implements bulk import scripts to load Congress 118-119 data into the database using the WP3-A ingestion infrastructure.

| Metric | Value |
|--------|-------|
| Priority | HIGH |
| Effort | 2-3 days (20-28 hours) |
| Confidence | 85% |
| Risk Level | MEDIUM |
| Dependencies | WP3-A (COMPLETE) |

---

## Acceptance Criteria

| ID | Criterion | Testable Metric | Test Method |
|----|-----------|-----------------|-------------|
| AC-7A-1 | 118th Congress bills loaded | Count matches Congress.gov total (~15,000) | `SELECT COUNT(*) FROM bills WHERE congress = 118` |
| AC-7A-2 | 119th Congress bills loaded | Count matches Congress.gov total (~5,000) | `SELECT COUNT(*) FROM bills WHERE congress = 119` |
| AC-7A-3 | All current legislators loaded | 535+ members present | `SELECT COUNT(*) FROM legislators WHERE term_end IS NULL` |
| AC-7A-4 | Committee structure loaded | All standing committees | `SELECT COUNT(*) FROM committees WHERE type = 'STANDING'` |
| AC-7A-5 | Roll call votes loaded (118th) | Vote records with positions | `SELECT COUNT(*) FROM roll_call_votes WHERE congress = 118` |
| AC-7A-6 | Data validates against API | Random sample matches source | Validation script comparison |
| AC-7A-7 | Full-text search indexes built | Bills/legislators searchable | `SELECT * FROM bills WHERE search_vector @@ to_tsquery('healthcare')` |
| AC-7A-8 | Import is resumable | Checkpoint allows restart | Kill/restart test passes |
| AC-7A-9 | Import completes <4 hours | Time-bounded execution | Execution timer log |
| AC-7A-10 | No duplicate records | Upsert logic verified | `SELECT bioguide_id, COUNT(*) FROM legislators GROUP BY 1 HAVING COUNT(*) > 1` returns 0 |

---

## Deliverables

### File Structure

```
apps/api/
├── scripts/
│   ├── bulk-import.ts            [CREATE] - Main orchestrator script
│   ├── import-config.ts          [CREATE] - Configuration and constants
│   ├── import-legislators.ts     [CREATE] - Legislators import logic
│   ├── import-committees.ts      [CREATE] - Committees import logic
│   ├── import-bills.ts           [CREATE] - Bills import logic
│   ├── import-votes.ts           [CREATE] - Votes import logic
│   ├── checkpoint-manager.ts     [CREATE] - Progress tracking/resumability
│   └── validate-import.ts        [CREATE] - Post-import validation
└── docs/
    └── data-import-runbook.md    [CREATE] - Operations guide
```

### Script Descriptions

| Script | Purpose | Lines (est.) |
|--------|---------|--------------|
| `bulk-import.ts` | CLI entrypoint, orchestrates phases | 150-200 |
| `import-config.ts` | Batch sizes, rate limits, Congress targets | 50-80 |
| `import-legislators.ts` | Fetches/upserts legislators from Congress.gov | 200-250 |
| `import-committees.ts` | Fetches/upserts committees and memberships | 150-200 |
| `import-bills.ts` | Fetches/upserts bills with all relations | 300-400 |
| `import-votes.ts` | Fetches/upserts roll calls and positions | 250-300 |
| `checkpoint-manager.ts` | JSON checkpoint file management | 100-150 |
| `validate-import.ts` | Count verification and sample comparison | 150-200 |

---

## Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Bulk Import Orchestrator                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Phase 1   │  │   Phase 2   │  │   Phase 3   │  │   Phase 4   │        │
│  │ Legislators │──│ Committees  │──│    Bills    │──│   Votes     │        │
│  │   (540+)    │  │   (250+)    │  │  (20,000+)  │  │  (850,000+) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WP3-A Ingestion Infrastructure                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Congress Client  │  │   Rate Limiter   │  │  Retry Handler   │          │
│  │  (congress-     │  │  (1000 req/hr)   │  │  (exp backoff)   │          │
│  │   client.ts)    │  │ (rate-limiter.ts)│  │(retry-handler.ts)│          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                │                                            │
│                                ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    Data Transformer                           │          │
│  │              (data-transformer.ts)                            │          │
│  └──────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  legislators │  │  committees  │  │    bills     │  │ roll_call_   │   │
│  │              │  │              │  │              │  │   votes      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Checkpoint State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │ start
                           ▼
                    ┌─────────────┐
              ┌────►│ LEGISLATORS │◄────┐
              │     └──────┬──────┘     │
              │            │ complete   │ resume (checkpoint: legislators)
              │            ▼            │
              │     ┌─────────────┐     │
              │     │ COMMITTEES  │◄────┼──── resume (checkpoint: committees)
              │     └──────┬──────┘     │
              │            │ complete   │
              │            ▼            │
              │     ┌─────────────┐     │
       error  │     │    BILLS    │◄────┼──── resume (checkpoint: bills)
       retry  │     └──────┬──────┘     │
              │            │ complete   │
              │            ▼            │
              │     ┌─────────────┐     │
              │     │    VOTES    │◄────┼──── resume (checkpoint: votes)
              │     └──────┬──────┘     │
              │            │ complete   │
              │            ▼            │
              │     ┌─────────────┐     │
              └─────│  VALIDATE   │─────┘
                    └──────┬──────┘
                           │ complete
                           ▼
                    ┌─────────────┐
                    │  COMPLETE   │
                    └─────────────┘
```

---

## Task Breakdown

### Phase 1: Infrastructure (4 hours)

| Task ID | Description | Est. Hours | Dependencies | Deliverable |
|---------|-------------|------------|--------------|-------------|
| T1.1 | Create `import-config.ts` with constants | 0.5h | None | Config file |
| T1.2 | Create `checkpoint-manager.ts` with JSON persistence | 1.5h | T1.1 | Checkpoint module |
| T1.3 | Create `bulk-import.ts` CLI skeleton | 1.0h | T1.1, T1.2 | CLI entrypoint |
| T1.4 | Add npm scripts to package.json | 0.5h | T1.3 | `pnpm import:*` commands |
| T1.5 | Create unit tests for checkpoint manager | 0.5h | T1.2 | Test file |

**Acceptance**: `pnpm --filter @ltip/api run import:status` shows checkpoint state

### Phase 2: Entity Import Scripts (8 hours)

| Task ID | Description | Est. Hours | Dependencies | Deliverable |
|---------|-------------|------------|--------------|-------------|
| T2.1 | Create `import-legislators.ts` | 2.0h | Phase 1 | Legislators importer |
| T2.2 | Create `import-committees.ts` | 1.5h | T2.1 | Committees importer |
| T2.3 | Create `import-bills.ts` with batch processing | 2.5h | T2.1, T2.2 | Bills importer |
| T2.4 | Create `import-votes.ts` with position batching | 2.0h | T2.3 | Votes importer |

**Acceptance**: Each script can be run independently with `--dry-run` flag

### Phase 3: Validation & Documentation (4 hours)

| Task ID | Description | Est. Hours | Dependencies | Deliverable |
|---------|-------------|------------|--------------|-------------|
| T3.1 | Create `validate-import.ts` | 1.5h | Phase 2 | Validation script |
| T3.2 | Create `data-import-runbook.md` | 1.0h | Phase 2 | Operations guide |
| T3.3 | Add integration tests | 1.0h | T3.1 | Test file |
| T3.4 | Test checkpoint resume behavior | 0.5h | All | Test report |

**Acceptance**: `pnpm --filter @ltip/api run import:validate` passes all checks

### Phase 4: Execution & Monitoring (4 hours)

| Task ID | Description | Est. Hours | Dependencies | Deliverable |
|---------|-------------|------------|--------------|-------------|
| T4.1 | Dry run with Congress 119 only | 1.0h | Phase 3 | Execution log |
| T4.2 | Full import execution | 2.0h | T4.1 | Imported data |
| T4.3 | Validation execution | 0.5h | T4.2 | Validation report |
| T4.4 | Search index rebuild verification | 0.5h | T4.3 | Search test results |

**Acceptance**: All AC-7A criteria pass

---

## Risk Assessment

### Risk Matrix

| ID | Risk | Probability | Impact | Score | Mitigation |
|----|------|-------------|--------|-------|------------|
| R1 | API quota exhaustion | HIGH | HIGH | 9 | Off-peak execution (2-6 AM), multi-session import |
| R2 | Import timeout/crash | MEDIUM | MEDIUM | 4 | Checkpoint-based resumability |
| R3 | Data integrity issues | LOW | HIGH | 3 | Validation script, transaction batching |
| R4 | Database performance | MEDIUM | MEDIUM | 4 | Batch inserts (100 records), index rebuild after |
| R5 | Network instability | LOW | LOW | 1 | Retry handler with exponential backoff |

### Mitigation Details

**R1 - API Quota**:
- Congress.gov allows 1000 requests/hour
- With ~20,000 bills needing details, expect 20+ hours of API calls
- Mitigation: Run during off-peak, checkpoint every 100 bills, multi-session support

**R2 - Import Crash**:
- JSON checkpoint file persists phase and offset
- On resume, skip completed entities
- Checkpoint format: `{ phase: "bills", congress: 118, offset: 5000, timestamp: ISO }`

**R3 - Data Integrity**:
- Use Prisma transactions for batch upserts
- Validate foreign key references before insert
- Post-import validation compares counts with API totals

---

## Effort Summary

| Phase | Tasks | Hours | Confidence |
|-------|-------|-------|------------|
| Infrastructure | T1.1-T1.5 | 4h | 90% |
| Entity Scripts | T2.1-T2.4 | 8h | 80% |
| Validation | T3.1-T3.4 | 4h | 90% |
| Execution | T4.1-T4.4 | 4h | 75% |
| **Total** | **17 tasks** | **20h** | **85%** |

**Calendar Time**: 2-3 days (accounting for API rate limits during execution)

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Required For |
|------------|--------|--------------|
| WP3-A Data Ingestion Core | COMPLETE | All import scripts |
| Prisma schema | COMPLETE | Database operations |
| PostgreSQL database | AVAILABLE | Data storage |

### External Dependencies

| Dependency | Status | Required For |
|------------|--------|--------------|
| Congress.gov API key | REQUIRED | API authentication |
| Network connectivity | REQUIRED | API calls |
| 5GB database storage | REQUIRED | Data storage |

---

## Test Plan

### Unit Tests

| Test File | Coverage Target | Test Count (est.) |
|-----------|-----------------|-------------------|
| `checkpoint-manager.test.ts` | 90% | 15 tests |
| `import-config.test.ts` | 80% | 5 tests |

### Integration Tests

| Test | Description | Expected Outcome |
|------|-------------|------------------|
| Checkpoint resume | Kill import mid-phase, resume | Picks up from checkpoint |
| Dry run mode | Run with `--dry-run` flag | No database writes |
| Validation pass | Run after successful import | All counts match |

### Validation Checks

| Check | SQL Query | Expected |
|-------|-----------|----------|
| Legislator count | `SELECT COUNT(*) FROM legislators` | >= 535 |
| Bill count 118 | `SELECT COUNT(*) FROM bills WHERE congress_number = 118` | ~15,000 |
| Bill count 119 | `SELECT COUNT(*) FROM bills WHERE congress_number = 119` | ~5,000 |
| Committee count | `SELECT COUNT(*) FROM committees` | >= 250 |
| Vote count | `SELECT COUNT(*) FROM roll_call_votes` | >= 1,500 |
| No duplicates | `SELECT bioguide_id, COUNT(*) FROM legislators GROUP BY 1 HAVING COUNT(*) > 1` | 0 rows |
| Search working | `SELECT COUNT(*) FROM bills WHERE search_vector @@ to_tsquery('healthcare')` | > 0 |

---

## Execution Runbook

### Pre-flight Checklist

- [ ] Congress.gov API key configured in `.env`
- [ ] PostgreSQL database accessible
- [ ] Sufficient disk space (5GB minimum)
- [ ] Off-peak hours (2-6 AM recommended)

### Execution Commands

```bash
# Check current status
pnpm --filter @ltip/api run import:status

# Dry run (no database writes)
pnpm --filter @ltip/api run import:dry-run

# Full import (or resume from checkpoint)
pnpm --filter @ltip/api run import:run

# Import specific phase only
pnpm --filter @ltip/api run import:legislators
pnpm --filter @ltip/api run import:committees
pnpm --filter @ltip/api run import:bills
pnpm --filter @ltip/api run import:votes

# Validate import
pnpm --filter @ltip/api run import:validate

# Reset checkpoint (start over)
pnpm --filter @ltip/api run import:reset
```

### Monitoring

```bash
# Watch import progress
tail -f apps/api/logs/import.log

# Check rate limiter status
curl http://localhost:4001/health/ingestion

# Database record counts
docker exec postgres psql -U postgres ltip -c "
  SELECT
    (SELECT COUNT(*) FROM legislators) as legislators,
    (SELECT COUNT(*) FROM committees) as committees,
    (SELECT COUNT(*) FROM bills) as bills,
    (SELECT COUNT(*) FROM roll_call_votes) as votes;
"
```

---

## Success Criteria

| Criterion | Metric | Target |
|-----------|--------|--------|
| Data completeness | Bill count | >= 18,000 |
| Data completeness | Legislator count | >= 535 |
| Data accuracy | Validation pass rate | 100% |
| Search functionality | Bills searchable | FTS returns results |
| Execution time | Total duration | < 4 hours |
| Resumability | Checkpoint test | Pass |

---

**Document End**
