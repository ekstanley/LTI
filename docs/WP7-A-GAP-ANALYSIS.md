# WP7-A Historical Data Load - Gap Analysis

**Date**: 2025-01-28
**Status**: Analysis Complete
**Author**: ODIN Code Agent

---

## Executive Summary

The WP7-A bulk import infrastructure is **functional** with checkpoint-based resumability, rate limiting, and House roll call votes. However, significant gaps exist between the current implementation and MASTER_SPECIFICATION requirements.

**Current Coverage**: ~35% of specified data sources and ~50% of Congress.gov API features.

---

## 1. Implementation Status

### ✅ Completed Features

| Component | Status | Notes |
|-----------|--------|-------|
| Bulk Import CLI | ✅ Complete | `bulk-import.ts` with checkpoint resumability |
| Legislators Import | ✅ Complete | All current Congress members via Congress.gov |
| Committees Import | ✅ Complete | Committee structure (no memberships) |
| Bills Import | ✅ Complete | Bills for Congress 118-119, basic metadata |
| House Votes Import | ✅ Complete | House roll call votes via Clerk XML |
| Rate Limiting | ✅ Complete | Token bucket, 1000 req/hour |
| Checkpoint Manager | ✅ Complete | JSON-based, resumable on crash |
| Validation Phase | ✅ Complete | Counts verification (skipped in dry-run) |
| Error Handling | ✅ Complete | Retry with backoff, 404 detection |

### ❌ Missing Features (Congress.gov API)

| Feature | Schema Support | Import Script | Priority |
|---------|---------------|---------------|----------|
| Senate Roll Call Votes | ✅ RollCallVote | ❌ Not implemented | HIGH |
| Bill Cosponsors | ✅ BillSponsor | ❌ Partial (count only) | HIGH |
| Bill Actions | ✅ BillAction | ❌ Not imported | MEDIUM |
| Bill Text Versions | ✅ BillTextVersion | ❌ Metadata only, no content | MEDIUM |
| Amendments | ✅ Amendment | ❌ Not imported | MEDIUM |
| Committee Memberships | ✅ CommitteeMembership | ❌ Not imported | MEDIUM |
| Committee Referrals | ✅ CommitteeReferral | ❌ Not imported | LOW |
| Subjects/Policy Areas | ✅ Subject, PolicyArea | ❌ Not imported | LOW |
| CBO Scores | ✅ CboScore | ❌ Not imported | LOW |

### ❌ Missing Data Sources (per MASTER_SPECIFICATION)

| Data Source | Specified Use | Status |
|-------------|---------------|--------|
| Congress.gov API | Bills, votes, members, committees | ⚠️ Partial |
| OpenStates API | State legislative data | ❌ Not implemented |
| LegiScan API | Enhanced legislative tracking | ❌ Not implemented |
| Federal Register | Regulations, executive orders | ❌ Not implemented |
| Google Scholar | Policy impact research | ❌ Not implemented |
| GAO/CBO Reports | Fiscal analysis | ❌ Not implemented |

---

## 2. Data Model Alignment

### Prisma Schema vs Import Coverage

```
Model                  │ Schema │ Import │ Gap
───────────────────────┼────────┼────────┼─────────────────────
Congress               │ ✅     │ ❌     │ Not seeded
Legislator             │ ✅     │ ✅     │ Basic fields only
Bill                   │ ✅     │ ✅     │ Missing summary, subjects
RollCallVote           │ ✅     │ ⚠️     │ House only, no Senate
Vote                   │ ✅     │ ⚠️     │ House only
BillSponsor            │ ✅     │ ❌     │ Not imported
BillTextVersion        │ ✅     │ ❌     │ Not imported
BillAction             │ ✅     │ ❌     │ Not imported
Amendment              │ ✅     │ ❌     │ Not imported
Committee              │ ✅     │ ✅     │ Complete
CommitteeMembership    │ ✅     │ ❌     │ Not imported
CommitteeReferral      │ ✅     │ ❌     │ Not imported
PolicyArea             │ ✅     │ ❌     │ Not imported
Subject                │ ✅     │ ❌     │ Not imported
BillSubject            │ ✅     │ ❌     │ Not imported
CboScore               │ ✅     │ ❌     │ Not imported
PartyChange            │ ✅     │ ❌     │ Not imported
```

### Field Coverage in Imported Models

**Legislator** - 70% populated:
- ✅ id, firstName, lastName, fullName, party, chamber, state, district
- ✅ dataSource, lastSyncedAt
- ❌ middleName, nickName, suffix, personId, leadershipRole
- ❌ termStart, termEnd, website, phone, address
- ❌ twitterHandle, facebookId, youtubeId

**Bill** - 50% populated:
- ✅ id, congressNumber, billType, billNumber, title, status
- ✅ introducedDate, lastActionDate, dataSource
- ❌ shortTitle, summary, previousVersionId, policyAreaId
- ❌ sponsorCount, cosponsorsD/R/I, voteCountYea/Nay, amendmentCount

**Committee** - 80% populated:
- ✅ id, name, chamber, type
- ✅ parentId (subcommittee hierarchy)
- ❌ jurisdiction

---

## 3. Infrastructure Gaps

### Sync/Scheduling

| Requirement (MASTER_SPEC) | Status |
|--------------------------|--------|
| Votes polling: 30 min during session | ❌ No scheduler |
| Bills polling: 6 hours | ❌ No scheduler |
| Members polling: daily | ❌ No scheduler |
| Committees polling: weekly | ❌ No scheduler |
| Incremental sync support | ❌ Full-sync only |
| Webhook/real-time updates | ❌ Not implemented |

### Data Quality & Provenance

| Feature | Status |
|---------|--------|
| DataSource tracking | ✅ Enum in schema, populated |
| DataQuality enum | ✅ In schema, not used |
| Cross-source validation | ❌ Not implemented |
| Deduplication logic | ❌ Not implemented |
| Import audit trail | ❌ Not persisted to DB |
| Import metrics | ❌ Console only, not stored |

### Resilience

| Feature | Status |
|---------|--------|
| Checkpoint resumability | ✅ Working |
| Rate limit handling | ✅ Token bucket |
| Retry with backoff | ✅ Exponential |
| 404 end-of-data detection | ✅ Fixed |
| Graceful shutdown | ✅ SIGINT/SIGTERM |
| Error aggregation | ⚠️ Last error only |

---

## 4. Prioritized Improvement Tasks

### Priority 1: Critical (WP7-A Scope)

1. **Import Bill Cosponsors** - HIGH
   - Schema: BillSponsor model ready
   - API: `/bill/{congress}/{type}/{number}/cosponsors`
   - Impact: Enables sponsor analytics

2. **Senate Roll Call Votes** - HIGH
   - Issue: Congress.gov API doesn't provide Senate votes
   - Alternative: Senate.gov XML scraping required
   - Impact: Complete vote coverage

3. **Seed Congress Table** - HIGH
   - Schema: Congress model exists but empty
   - Required for foreign key integrity
   - Impact: Database consistency

### Priority 2: Important (Enhanced Coverage)

4. **Import Bill Actions** - MEDIUM
   - Schema: BillAction model ready
   - API: `/bill/{congress}/{type}/{number}/actions`
   - Impact: Bill progression tracking

5. **Import Committee Memberships** - MEDIUM
   - Schema: CommitteeMembership model ready
   - API: May require scraping or bulk data
   - Impact: Committee analytics

6. **Import Subjects/Policy Areas** - MEDIUM
   - Schema: Subject, PolicyArea, BillSubject ready
   - API: Available in bill detail response
   - Impact: Topic categorization

### Priority 3: Nice-to-Have

7. **Import Bill Text Versions** - LOW
   - Schema: BillTextVersion ready
   - Storage: Requires S3/R2 for content
   - Impact: Full-text search capability

8. **Import CBO Scores** - LOW
   - Schema: CboScore ready
   - Source: CBO website scraping
   - Impact: Fiscal analysis

9. **Import Amendments** - LOW
   - Schema: Amendment ready
   - API: `/bill/{congress}/{type}/{number}/amendments`
   - Impact: Amendment tracking

---

## 5. Recommended Next Steps

### Immediate (Complete WP7-A)

1. Add `import-cosponsors.ts` phase to populate BillSponsor
2. Create Congress table seeder for 118-119
3. Update import-config.ts to include new phases
4. Add incremental sync support (fromDateTime filtering)

### Short-term (WP7-B Preparation)

1. Implement scheduled sync jobs (cron/bull queue)
2. Add import audit logging to database
3. Implement Senate vote scraping
4. Add data quality scoring

### Medium-term (Full Spec Compliance)

1. Integrate OpenStates API for state data
2. Integrate LegiScan API for enhanced tracking
3. Add Federal Register integration
4. Implement cross-source data validation

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Senate vote API unavailable | HIGH | HIGH | Use Senate.gov XML scraping |
| Rate limit exhaustion | MEDIUM | MEDIUM | Current token bucket handles this |
| Data inconsistency | MEDIUM | MEDIUM | Add cross-source validation |
| Schema migration issues | LOW | HIGH | Test migrations on staging first |
| API breaking changes | LOW | MEDIUM | Version pin, monitor changelog |

---

## Appendix: File Reference

```
apps/api/
├── scripts/
│   ├── bulk-import.ts        # CLI orchestrator
│   ├── import-config.ts      # Configuration
│   ├── checkpoint-manager.ts # Resumability
│   ├── import-legislators.ts # Phase 1
│   ├── import-committees.ts  # Phase 2
│   ├── import-bills.ts       # Phase 3
│   ├── import-votes.ts       # Phase 4 (House only)
│   └── validate-import.ts    # Phase 5
├── src/ingestion/
│   ├── types.ts              # API response types
│   ├── congress-client.ts    # Congress.gov client
│   ├── rate-limiter.ts       # Token bucket
│   └── retry-handler.ts      # Retry logic
└── prisma/
    └── schema.prisma         # Database models
```
