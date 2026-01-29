# WP7 Data Ingestion - Improvement Tasks

**Date**: 2025-01-28
**Source**: WP7-A Gap Analysis
**Total Tasks**: 12

---

## Task Template Legend

- **ID**: WP7-XXX
- **Priority**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)
- **Effort**: S (1-2h) | M (4-8h) | L (2-3d) | XL (1wk+)
- **Status**: BACKLOG | IN_PROGRESS | REVIEW | DONE

---

## Priority 0: Critical (Must Complete for WP7-A)

### WP7-001: Seed Congress Table

**Priority**: P0 | **Effort**: S | **Status**: BACKLOG

**Description**: The `Congress` table is empty. Bills have `congressNumber` FK but no corresponding Congress records exist. This breaks referential integrity.

**Acceptance Criteria**:
- [ ] Congress 118 record created (2023-01-03 to 2025-01-03)
- [ ] Congress 119 record created (2025-01-03 to null)
- [ ] `houseMajority` and `senateMajority` populated
- [ ] Seed script idempotent (safe to run multiple times)
- [ ] Unit test validates Congress records exist

**Implementation**:
```bash
# Create file: apps/api/scripts/seed-congress.ts
# Run as first step in import pipeline
```

**Files**:
- `apps/api/scripts/seed-congress.ts` (new)
- `apps/api/scripts/import-config.ts` (add 'seed-congress' phase)

---

### WP7-002: Import Bill Cosponsors

**Priority**: P0 | **Effort**: M | **Status**: BACKLOG

**Description**: BillSponsor model exists but cosponsors not imported. Only sponsor count is captured from bill detail. Full cosponsor data needed for sponsor analytics.

**Acceptance Criteria**:
- [ ] Primary sponsor identified and marked `isPrimary: true`
- [ ] All cosponsors imported with `cosponsorDate`
- [ ] Withdrawn cosponsors tracked with `withdrawnDate`
- [ ] `bill.sponsorCount`, `cosponsorsD/R/I` denormalized correctly
- [ ] Handles 20,000+ bills with 250 API limit pagination
- [ ] Checkpoint supports resuming mid-bill

**API Endpoint**: `GET /bill/{congress}/{type}/{number}/cosponsors`

**Files**:
- `apps/api/scripts/import-cosponsors.ts` (new)
- `apps/api/src/ingestion/types.ts` (extend if needed)

---

### WP7-003: Import Bill Actions

**Priority**: P0 | **Effort**: M | **Status**: BACKLOG

**Description**: BillAction model exists but actions not imported. Actions show bill progression and are critical for status tracking.

**Acceptance Criteria**:
- [ ] All actions imported with `actionDate`, `actionCode`, `actionText`
- [ ] Chamber correctly identified per action
- [ ] Committee associations populated when present
- [ ] Bill `lastActionDate` updated from latest action
- [ ] Handles bulk import (20k bills x avg 10 actions = 200k records)

**API Endpoint**: `GET /bill/{congress}/{type}/{number}/actions`

**Files**:
- `apps/api/scripts/import-bill-actions.ts` (new)

---

## Priority 1: High (Enhanced Coverage)

### WP7-004: Import Subjects and Policy Areas

**Priority**: P1 | **Effort**: M | **Status**: BACKLOG

**Description**: Bills have policy areas and subjects in API response but not imported. Needed for topic categorization and filtering.

**Acceptance Criteria**:
- [ ] PolicyArea records created from distinct policy areas
- [ ] Subject records created with hierarchy (parentId)
- [ ] BillSubject junction records created
- [ ] `isPrimary` flag set for primary subject per bill
- [ ] Deduplication by name

**Data Source**: Bill detail response contains `policyArea` and `subjects` objects

**Files**:
- `apps/api/scripts/import-subjects.ts` (new)

---

### WP7-005: Import Committee Memberships

**Priority**: P1 | **Effort**: M | **Status**: BACKLOG

**Description**: Committees imported but memberships are not. Needed to know who serves on which committees.

**Acceptance Criteria**:
- [ ] Current members linked to committees
- [ ] Role (Chair, Ranking Member, Member) populated
- [ ] `startDate` populated (from term start or committee data)
- [ ] Historical memberships preserved (no deletion)

**API/Data Source**: May require bulk data download from Congress.gov or scraping

**Files**:
- `apps/api/scripts/import-committee-memberships.ts` (new)

---

### WP7-006: Incremental Sync Support

**Priority**: P1 | **Effort**: L | **Status**: BACKLOG

**Description**: Current import is full-sync only. Need incremental sync using `fromDateTime` parameter to reduce API load and enable scheduled updates.

**Acceptance Criteria**:
- [ ] `fromDateTime` parameter used for bills, members, votes
- [ ] `lastSyncedAt` tracked per entity type
- [ ] CLI flag `--since YYYY-MM-DD` for manual incremental
- [ ] Auto-detect last sync time from checkpoint
- [ ] Handles updates vs inserts correctly (upsert)

**Implementation**:
```typescript
// In congress-client.ts getBills()
if (options.fromDateTime) {
  params.fromDateTime = options.fromDateTime.toISOString();
}
```

**Files**:
- `apps/api/scripts/import-config.ts` (add sync state tracking)
- `apps/api/scripts/bulk-import.ts` (add --since flag)
- All import scripts (add fromDateTime filtering)

---

### WP7-007: Senate Roll Call Votes (Scraping)

**Priority**: P1 | **Effort**: XL | **Status**: BACKLOG

**Description**: Congress.gov API does not provide Senate votes. Need to scrape Senate.gov XML.

**Acceptance Criteria**:
- [ ] Senate.gov vote XML parser implemented
- [ ] Maps to same RollCallVote/Vote models
- [ ] Roll numbers correctly prefixed `s{year}-{number}`
- [ ] Individual senator votes captured
- [ ] Rate limiting for Senate.gov
- [ ] Error handling for malformed XML

**Data Source**: `https://www.senate.gov/legislative/LIS/roll_call_votes/`

**Files**:
- `apps/api/src/ingestion/senate-client.ts` (new)
- `apps/api/scripts/import-votes.ts` (add Senate phase)

**Risk**: Senate.gov may block scraping or change format without notice

---

## Priority 2: Medium (Completeness)

### WP7-008: Import Bill Text Versions Metadata

**Priority**: P2 | **Effort**: M | **Status**: BACKLOG

**Description**: BillTextVersion model exists. Import version metadata (not full text content initially).

**Acceptance Criteria**:
- [ ] All text versions imported per bill (ih, rh, eh, enr, etc.)
- [ ] `textUrl` populated from GPO/Congress.gov
- [ ] `publishedDate` populated
- [ ] `textFormat` correctly identified (XML, HTML, PDF)
- [ ] `textHash` computed for deduplication

**Note**: Full text content storage (S3/R2) deferred to WP7-C

**Files**:
- `apps/api/scripts/import-text-versions.ts` (new)

---

### WP7-009: Import Amendments

**Priority**: P2 | **Effort**: M | **Status**: BACKLOG

**Description**: Amendment model exists but amendments not imported.

**Acceptance Criteria**:
- [ ] All amendments imported with sponsor, purpose, status
- [ ] 2nd degree amendments linked via `parentAmendmentId`
- [ ] Bill `amendmentCount` updated
- [ ] Amendment ID format: `hamdt-{number}-{congress}` or `samdt-...`

**API Endpoint**: `GET /bill/{congress}/{type}/{number}/amendments`

**Files**:
- `apps/api/scripts/import-amendments.ts` (new)

---

### WP7-010: Enhance Legislator Data

**Priority**: P2 | **Effort**: S | **Status**: BACKLOG

**Description**: Legislator import captures basic fields. Enhance with contact and social info.

**Acceptance Criteria**:
- [ ] `website`, `phone`, `address` populated from member detail
- [ ] `twitterHandle`, `facebookId`, `youtubeId` populated
- [ ] `termStart`, `termEnd` populated from term data
- [ ] `leadershipRole` populated if applicable

**Files**:
- `apps/api/scripts/import-legislators.ts` (enhance)

---

## Priority 3: Low (Nice-to-Have)

### WP7-011: Import CBO Scores

**Priority**: P3 | **Effort**: L | **Status**: BACKLOG

**Description**: CboScore model exists. CBO cost estimates provide fiscal impact data.

**Acceptance Criteria**:
- [ ] CBO reports scraped for scored bills
- [ ] `costEstimate`, `deficitImpact`, `timeframe` populated
- [ ] `reportUrl` linked to CBO website
- [ ] Only bills with CBO scores imported

**Data Source**: CBO website (requires scraping)

**Risk**: CBO website structure changes frequently

**Files**:
- `apps/api/src/ingestion/cbo-client.ts` (new)
- `apps/api/scripts/import-cbo-scores.ts` (new)

---

### WP7-012: Import Committee Referrals

**Priority**: P3 | **Effort**: S | **Status**: BACKLOG

**Description**: Track which committees bills are referred to.

**Acceptance Criteria**:
- [ ] CommitteeReferral records created per bill
- [ ] `isPrimary` flag set for primary referral
- [ ] `referralDate` populated from bill actions

**Data Source**: Bill actions contain committee referral information

**Files**:
- `apps/api/scripts/import-bill-actions.ts` (extend to create referrals)

---

## Implementation Sequence

Recommended order based on dependencies:

```
Phase 1 (WP7-A Completion):
  WP7-001 (Congress seed)
  └── WP7-002 (Cosponsors) ─┐
  └── WP7-003 (Actions) ────┼── Can run in parallel
  └── WP7-004 (Subjects) ───┘

Phase 2 (Enhanced Coverage):
  WP7-006 (Incremental sync)
  WP7-005 (Committee memberships)
  WP7-010 (Enhanced legislators)

Phase 3 (Completeness):
  WP7-008 (Text versions)
  WP7-009 (Amendments)
  WP7-012 (Referrals) - depends on WP7-003

Phase 4 (Extended Sources):
  WP7-007 (Senate votes) - high effort, independent
  WP7-011 (CBO scores) - independent
```

---

## Metrics for Success

| Metric | Current | Target |
|--------|---------|--------|
| Congress.gov API coverage | 40% | 90% |
| Prisma models populated | 6/20 | 16/20 |
| Bills with cosponsors | 0% | 100% |
| Bills with actions | 0% | 100% |
| Vote coverage | House only | House + Senate |
| Incremental sync | No | Yes |

---

## Notes

- All tasks assume existing checkpoint infrastructure remains unchanged
- Rate limiting already handles Congress.gov limits (1000/hour)
- Database migrations may be needed if schema changes
- Testing should use dry-run mode before production import
