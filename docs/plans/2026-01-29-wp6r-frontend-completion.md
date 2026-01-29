# WP6-R: Frontend Completion - ODIN Task Breakdown

**Document Version**: 1.0.0
**Created**: 2026-01-29
**Methodology**: ODIN (Outline Driven INtelligence)
**Status**: APPROVED FOR EXECUTION
**Priority**: HIGH
**Estimated Effort**: 8-12 hours

---

## Executive Summary

WP6-R completes the frontend MVP by connecting existing UI scaffolding to the live API and implementing missing pages/components.

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Pages | 2 (home, bills list) | 6 | 4 pages |
| Components | 6 | 14 | 8 components |
| API Integration | Mock data | Live API | Full migration |
| Test Coverage | 0% | Manual QA | Manual test plan |

---

## Current State Analysis

### Existing Assets (12 files)

```
apps/web/src/
├── app/
│   ├── layout.tsx           [EXISTS] Root layout with navigation
│   ├── page.tsx             [EXISTS] Home page (hero, features, stats)
│   └── bills/
│       └── page.tsx         [EXISTS] Bills list (MOCK DATA)
├── components/
│   ├── ui/
│   │   ├── Badge.tsx        [EXISTS] Status/tag badge component
│   │   ├── Card.tsx         [EXISTS] Card container component
│   │   ├── Skeleton.tsx     [EXISTS] Loading skeleton component
│   │   └── index.ts         [EXISTS] Barrel export
│   └── bills/
│       ├── BiasSpectrum.tsx [EXISTS] Political bias visualization
│       ├── BillCard.tsx     [EXISTS] Bill preview card
│       └── index.ts         [EXISTS] Barrel export
└── lib/
    ├── api.ts               [EXISTS] Complete API client (typed)
    └── utils.ts             [EXISTS] cn() utility for Tailwind
```

### Missing Deliverables

| Category | Missing | Priority |
|----------|---------|----------|
| Pages | bills/[id], legislators, legislators/[id], votes | HIGH |
| Common Components | SearchInput, FilterSelect, Pagination, ErrorBoundary | HIGH |
| Legislator Components | LegislatorCard, LegislatorStats | MEDIUM |
| Hooks | useBills, useLegislators, useVotes (SWR) | HIGH |
| Infrastructure | hooks/ directory | HIGH |

---

## Task Breakdown

### Task 1: Infrastructure Setup

**ID**: WP6R-T1
**Effort**: 30 minutes
**Risk**: Low
**Dependencies**: None

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T1-1 | hooks/ directory exists | `ls apps/web/src/hooks` |
| AC-T1-2 | components/common/ exists | `ls apps/web/src/components/common` |
| AC-T1-3 | components/legislators/ exists | `ls apps/web/src/components/legislators` |

#### Deliverables

```
apps/web/src/
├── hooks/
│   └── index.ts             [CREATE] Barrel export
├── components/
│   ├── common/
│   │   └── index.ts         [CREATE] Barrel export
│   └── legislators/
│       └── index.ts         [CREATE] Barrel export
```

---

### Task 2: SWR Data Fetching Hooks

**ID**: WP6R-T2
**Effort**: 1 hour
**Risk**: Low
**Dependencies**: T1

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T2-1 | useBills returns loading/error/data | Console log in component |
| AC-T2-2 | useBillDetail fetches single bill | Network tab shows `/api/v1/bills/:id` |
| AC-T2-3 | useLegislators returns paginated data | Console log confirms pagination |
| AC-T2-4 | useLegislatorDetail fetches single legislator | Network tab shows `/api/v1/legislators/:id` |
| AC-T2-5 | useVotes returns roll call data | Network tab shows `/api/v1/votes` |
| AC-T2-6 | Hooks handle API errors gracefully | Error state populated on 500 |

#### Deliverables

```
apps/web/src/hooks/
├── useBills.ts              [CREATE] Bills list + detail hooks
├── useLegislators.ts        [CREATE] Legislators list + detail hooks
├── useVotes.ts              [CREATE] Votes list + detail hooks
└── index.ts                 [MODIFY] Export all hooks
```

#### Technical Notes

- Use SWR (already installed) with `fetcher` from `lib/api.ts`
- Configure `revalidateOnFocus: false` for stability
- Return `{ data, error, isLoading, mutate }` pattern
- Type responses using existing API types

---

### Task 3: Common Components

**ID**: WP6R-T3
**Effort**: 1.5 hours
**Risk**: Low
**Dependencies**: None (can parallelize with T2)

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T3-1 | SearchInput triggers callback on debounced input | 300ms delay between typing and callback |
| AC-T3-2 | FilterSelect displays options and triggers onChange | Dropdown visible, selection callback fires |
| AC-T3-3 | Pagination shows page info and navigates | "Page 1 of 5" visible, buttons functional |
| AC-T3-4 | ErrorBoundary catches render errors | Error UI shown instead of crash |
| AC-T3-5 | Components follow Tailwind patterns | Uses cn() utility, consistent styling |

#### Deliverables

```
apps/web/src/components/common/
├── SearchInput.tsx          [CREATE] Debounced search with icon
├── FilterSelect.tsx         [CREATE] Dropdown filter component
├── Pagination.tsx           [CREATE] Page navigation controls
├── ErrorBoundary.tsx        [CREATE] React error boundary
└── index.ts                 [MODIFY] Export all components
```

#### Component Specifications

**SearchInput**
```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;  // default: 300
}
```

**FilterSelect**
```typescript
interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}
```

**Pagination**
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}
```

---

### Task 4: Bills Page API Integration

**ID**: WP6R-T4
**Effort**: 1.5 hours
**Risk**: Medium (API contract validation needed)
**Dependencies**: T2, T3

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T4-1 | Bills load from API on page render | Network tab shows `/api/v1/bills` |
| AC-T4-2 | Loading skeleton displays during fetch | Skeleton visible for 1-2 seconds |
| AC-T4-3 | Pagination updates offset and refetches | URL shows `?offset=20`, new data loads |
| AC-T4-4 | Search filters bills by query | API call includes `?q=search_term` |
| AC-T4-5 | Chamber filter updates results | API call includes `?chamber=house` |
| AC-T4-6 | Status filter updates results | API call includes `?status=introduced` |
| AC-T4-7 | Error state displays on API failure | "Failed to load bills" message shown |
| AC-T4-8 | Add 'use client' directive | Component marked as client component |

#### Deliverables

```
apps/web/src/app/bills/page.tsx    [MODIFY] Connect to live API
```

#### Key Changes

1. Add `'use client'` directive (interactive elements)
2. Replace mock data with `useBills` hook
3. Wire SearchInput to query parameter
4. Wire FilterSelect components to chamber/status
5. Wire Pagination to offset/limit
6. Add loading state with Skeleton
7. Add error state with retry button

---

### Task 5: Bill Detail Page

**ID**: WP6R-T5
**Effort**: 1.5 hours
**Risk**: Medium
**Dependencies**: T2

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T5-1 | Page loads bill by ID from URL | `/bills/hr1234-118` fetches correct bill |
| AC-T5-2 | Bill title and summary display | Content visible on page |
| AC-T5-3 | Sponsor information displays | Sponsor name and party shown |
| AC-T5-4 | Cosponsors list renders | List of cosponsors visible |
| AC-T5-5 | Actions timeline renders | Bill history chronologically |
| AC-T5-6 | BiasSpectrum component renders | Political lean visualization |
| AC-T5-7 | 404 page for invalid bill ID | "Bill not found" on bad ID |
| AC-T5-8 | Back navigation works | "Back to Bills" link functional |

#### Deliverables

```
apps/web/src/app/bills/[id]/page.tsx    [CREATE] Bill detail page
```

#### Layout Structure

```
Bill Detail Page
├── Back link ("< Back to Bills")
├── Header
│   ├── Bill ID badge (e.g., "H.R. 1234")
│   ├── Bill title
│   ├── Status badge
│   └── BiasSpectrum
├── Summary section
├── Sponsor card
├── Cosponsors list (collapsible if >10)
├── Actions timeline
└── Related bills (if available)
```

---

### Task 6: Legislators List Page

**ID**: WP6R-T6
**Effort**: 1.5 hours
**Risk**: Low
**Dependencies**: T2, T3

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T6-1 | Page loads legislators from API | Network shows `/api/v1/legislators` |
| AC-T6-2 | LegislatorCard renders for each result | Card grid visible |
| AC-T6-3 | Search by name works | API includes `?q=name` |
| AC-T6-4 | Filter by party works | API includes `?party=D` or `?party=R` |
| AC-T6-5 | Filter by chamber works | API includes `?chamber=house` |
| AC-T6-6 | Filter by state works | API includes `?state=CA` |
| AC-T6-7 | Pagination works | Offset changes on page nav |
| AC-T6-8 | Card links to detail page | Click navigates to `/legislators/:id` |

#### Deliverables

```
apps/web/src/
├── app/legislators/page.tsx           [CREATE] Legislators list page
└── components/legislators/
    ├── LegislatorCard.tsx             [CREATE] Legislator preview card
    └── index.ts                       [MODIFY] Export components
```

#### LegislatorCard Specification

```typescript
interface LegislatorCardProps {
  id: string;
  name: string;
  party: 'D' | 'R' | 'I';
  state: string;
  chamber: 'house' | 'senate';
  imageUrl?: string;
  district?: string;
}
```

Display: Photo (placeholder if none), Name, Party badge, State-District, Chamber

---

### Task 7: Legislator Detail Page

**ID**: WP6R-T7
**Effort**: 1.5 hours
**Risk**: Medium
**Dependencies**: T2, T6

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T7-1 | Page loads legislator by bioguide ID | `/legislators/A000123` fetches data |
| AC-T7-2 | Bio information displays | Name, party, state, chamber |
| AC-T7-3 | Photo or placeholder displays | Image visible |
| AC-T7-4 | Contact info displays | Website, office address if available |
| AC-T7-5 | Committee memberships display | List of committees |
| AC-T7-6 | Recent votes summary displays | Latest 5-10 votes |
| AC-T7-7 | Sponsored bills list displays | Bills they sponsored |
| AC-T7-8 | 404 for invalid ID | "Legislator not found" |
| AC-T7-9 | Back navigation works | "Back to Legislators" link |

#### Deliverables

```
apps/web/src/app/legislators/[id]/page.tsx    [CREATE] Legislator detail
```

#### Layout Structure

```
Legislator Detail Page
├── Back link ("< Back to Legislators")
├── Header
│   ├── Photo/placeholder
│   ├── Name
│   ├── Party badge
│   ├── State-District
│   └── Chamber badge
├── Contact section (website, office)
├── Committees section
├── Recent votes section (table)
└── Sponsored bills section (cards)
```

---

### Task 8: Votes Page (Basic)

**ID**: WP6R-T8
**Effort**: 1 hour
**Risk**: Low
**Dependencies**: T2, T3

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T8-1 | Page loads recent roll calls | Network shows `/api/v1/votes` |
| AC-T8-2 | Vote cards display key info | Question, date, result |
| AC-T8-3 | Party breakdown visualization | Yea/Nay by party |
| AC-T8-4 | Filter by chamber works | House/Senate filter |
| AC-T8-5 | Pagination works | Navigate through results |
| AC-T8-6 | Click navigates to vote detail | Future enhancement link |

#### Deliverables

```
apps/web/src/app/votes/page.tsx    [CREATE] Roll call votes list
```

**Note**: WebSocket live updates deferred to WP6-B (Phase 2).

---

### Task 9: Navigation and Layout Updates

**ID**: WP6R-T9
**Effort**: 30 minutes
**Risk**: Low
**Dependencies**: T5, T6, T7, T8

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T9-1 | Navigation includes all pages | Home, Bills, Legislators, Votes visible |
| AC-T9-2 | Active page highlighted | Current route styled differently |
| AC-T9-3 | Mobile menu works | Hamburger menu on small screens |
| AC-T9-4 | Footer consistent | Same footer on all pages |

#### Deliverables

```
apps/web/src/app/layout.tsx    [MODIFY] Update navigation links
```

---

### Task 10: Error Handling and Polish

**ID**: WP6R-T10
**Effort**: 1 hour
**Risk**: Low
**Dependencies**: T4-T8

#### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-T10-1 | ErrorBoundary wraps page content | Error caught, UI not crashed |
| AC-T10-2 | API errors show user-friendly message | "Unable to load data" with retry |
| AC-T10-3 | Empty states handled | "No bills found" for empty results |
| AC-T10-4 | Loading skeletons consistent | Same skeleton pattern across pages |
| AC-T10-5 | 404 page exists | Custom not-found page |
| AC-T10-6 | Responsive design verified | 375px, 768px, 1024px viewports |

#### Deliverables

```
apps/web/src/app/not-found.tsx    [CREATE] Custom 404 page
```

---

## Dependency Graph

```
T1 (Infrastructure)
│
├── T2 (SWR Hooks) ──────┬── T4 (Bills API) ─────┐
│                        │                        │
│                        ├── T5 (Bill Detail) ───┤
│                        │                        │
│                        ├── T6 (Legislators) ───┼── T9 (Navigation)
│                        │           │            │
│                        │           └── T7 ─────┤
│                        │                        │
│                        └── T8 (Votes) ─────────┤
│                                                 │
└── T3 (Common Components) ──────────────────────┴── T10 (Polish)
```

**Parallelizable**: T2 and T3 can run in parallel after T1
**Critical Path**: T1 → T2 → T4 → T5 → T9 → T10

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API contract mismatch | Medium | Medium | Test against live API early (T2) |
| SWR caching stale data | Low | Low | Configure appropriate revalidation |
| Missing 'use client' directive | High | Low | Checklist for interactive components |
| Type errors from API | Medium | Medium | Use existing API types from lib/api.ts |
| Responsive breakage | Low | Medium | Test 3 viewports per page |
| Performance on large lists | Medium | Medium | Paginate (already planned) |

---

## Effort Summary

| Task | ID | Hours | Confidence |
|------|-----|-------|------------|
| Infrastructure Setup | T1 | 0.5 | High |
| SWR Hooks | T2 | 1.0 | High |
| Common Components | T3 | 1.5 | High |
| Bills Page API | T4 | 1.5 | Medium |
| Bill Detail Page | T5 | 1.5 | Medium |
| Legislators List | T6 | 1.5 | High |
| Legislator Detail | T7 | 1.5 | Medium |
| Votes Page | T8 | 1.0 | High |
| Navigation Update | T9 | 0.5 | High |
| Error Handling | T10 | 1.0 | High |
| **Total** | | **11.5h** | ~1.5 days |

---

## Test Plan

### Manual Testing Checklist

**Bills Page**
- [ ] Load with API data
- [ ] Search filters results
- [ ] Chamber filter works
- [ ] Status filter works
- [ ] Pagination navigates correctly
- [ ] Click card navigates to detail

**Bill Detail Page**
- [ ] Loads by ID from URL
- [ ] Shows all bill sections
- [ ] BiasSpectrum renders
- [ ] Back link works
- [ ] 404 on invalid ID

**Legislators Page**
- [ ] Load with API data
- [ ] Search by name works
- [ ] Party filter works
- [ ] Chamber filter works
- [ ] State filter works
- [ ] Pagination works
- [ ] Click card navigates to detail

**Legislator Detail Page**
- [ ] Loads by bioguide ID
- [ ] Shows all sections
- [ ] Committees display
- [ ] Recent votes display
- [ ] Back link works
- [ ] 404 on invalid ID

**Votes Page**
- [ ] Loads roll calls
- [ ] Chamber filter works
- [ ] Pagination works
- [ ] Party breakdown displays

**Cross-cutting**
- [ ] Navigation works on all pages
- [ ] Mobile responsive (375px)
- [ ] Tablet responsive (768px)
- [ ] Desktop layout (1024px+)
- [ ] Error states display properly
- [ ] Loading states display properly

---

## Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| Build | `pnpm --filter @ltip/web build` passes | PENDING |
| Types | `pnpm --filter @ltip/web typecheck` clean | PENDING |
| Lint | `pnpm --filter @ltip/web lint` clean | PENDING |
| Pages | 6 pages functional | PENDING |
| API | All pages connected to live API | PENDING |
| Responsive | 3 viewports verified | PENDING |
| Errors | All error states implemented | PENDING |

---

## Execution Notes

### Prerequisites

1. API server running (`pnpm --filter @ltip/api run dev`)
2. Database seeded with test data
3. Environment variables configured

### Recommended Execution Order

1. **T1** - Infrastructure (blocking)
2. **T2 + T3** - Hooks + Components (parallel)
3. **T4** - Bills page integration (validates API)
4. **T5 + T6** - Bill detail + Legislators list (parallel)
5. **T7 + T8** - Legislator detail + Votes (parallel)
6. **T9** - Navigation update
7. **T10** - Polish and verification

### Commit Strategy

Each task should be a separate atomic commit:
- `feat(web): add SWR data fetching hooks (WP6R-T2)`
- `feat(web): add common components (WP6R-T3)`
- `feat(web): connect bills page to API (WP6R-T4)`
- etc.

---

**Document End**
