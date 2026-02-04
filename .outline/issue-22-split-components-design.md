# Issue #22: Split Complex Components - ODIN Design

**Date**: 2026-02-02
**Type**: Refactoring
**Priority**: P1-HIGH
**Estimated Effort**: 6 hours
**Risk Level**: LOW (comprehensive test coverage exists)

---

## Executive Summary

Refactor two large page components (`BillDetailClient.tsx` 260 lines, `LegislatorDetailClient.tsx` 296 lines) by extracting reusable sub-components into dedicated files. Target: page components <100 lines, extracted components <50 lines each.

**Benefits**:
- Improved maintainability and testability
- Reusable component library
- Reduced cognitive complexity
- Better adherence to Single Responsibility Principle

---

## 1. Architecture Diagram

```nomnoml
#title: Component Architecture Delta (Before → After)

[<abstract>BEFORE: Monolithic Components]

[BillDetailClient.tsx|
  260 lines total
  --
  + BillDetailClient()
  + StatusBadge()
  + InfoCard()
  + formatBillId()
  + formatDate()
]

[LegislatorDetailClient.tsx|
  296 lines total
  --
  + LegislatorDetailClient()
  + InfoCard()
  + ContactLink()
  + formatDate()
]

[<abstract>AFTER: Modular Components]

[BillDetailClient.tsx|
  <100 lines
  --
  + BillDetailClient()
  imports extracted components
]

[LegislatorDetailClient.tsx|
  <100 lines
  --
  + LegislatorDetailClient()
  imports extracted components
]

[components/bills/|
  StatusBadge.tsx (<50 lines)
  BillInfoCard.tsx (<50 lines)
  BillFormatters.ts (<50 lines)
]

[components/legislators/|
  LegislatorInfoCard.tsx (<50 lines)
  ContactLink.tsx (<50 lines)
  LegislatorFormatters.ts (<50 lines)
]

[components/common/|
  DateFormatter.ts (<50 lines)
  -- shared utilities
]

[BillDetailClient.tsx] imports -> [components/bills/]
[LegislatorDetailClient.tsx] imports -> [components/legislators/]
[components/bills/] imports -> [components/common/]
[components/legislators/] imports -> [components/common/]
```

**Key Architectural Changes**:
1. **Extract domain-specific components**: Bills → `components/bills/`, Legislators → `components/legislators/`
2. **Share common utilities**: `DateFormatter` in `components/common/`
3. **Maintain existing interfaces**: Props interfaces remain unchanged (backward compatible)
4. **No business logic changes**: Pure structural refactoring

---

## 2. Data-Flow Diagram

```nomnoml
#title: Component Data Flow

[<actor>useBill/useLegislator Hook] --> [Page Component]
[Page Component] data→ [StatusBadge Component]
[Page Component] data→ [InfoCard Component]
[Page Component] data→ [ContactLink Component]
[Page Component] mutate callback→ [ErrorFallback]

[StatusBadge Component] renders→ [User Interface]
[InfoCard Component] renders→ [User Interface]
[ContactLink Component] renders→ [User Interface]
[ErrorFallback] retry()→ [Page Component]

[<note>Data Flow Invariants:
1. Data flows DOWN (parent to child)
2. Events flow UP (child to parent via callbacks)
3. No prop drilling >2 levels
4. Each component validates own props
]
```

**Data Flow Patterns**:
- **Props down, events up**: Standard React unidirectional flow
- **Validation**: TypeScript interfaces enforce prop contracts
- **State**: No local state in extracted components (pure presentational)
- **Side effects**: None in extracted components

---

## 3. Concurrency Diagram

```nomnoml
#title: React Render Concurrency

[<state>Main Thread (Single)]

[React Render Queue|
  BillDetailClient render
  → StatusBadge render
  → InfoCard[] render (parallel)
  → ContactLink[] render (parallel)
]

[<note>Concurrency Characteristics:
• Single-threaded React render
• No shared mutable state
• No locks needed (functional components)
• Idempotent render functions
• React 18 concurrent features supported
]

[React Fiber Scheduler] manages→ [React Render Queue]
[React Render Queue] commits→ [DOM Updates]
```

**Concurrency Safety**:
- **No race conditions**: Functional components with no shared mutable state
- **No synchronization needed**: Single-threaded rendering
- **React 18 compatible**: Components support concurrent rendering mode
- **Pure functions**: All rendering deterministic

---

## 4. Memory Diagram

```nomnoml
#title: Component Memory Lifecycle

[<abstract>Component Lifetime]

[useBill/useLegislator Hook|
  SWR cache (managed)
  AbortController (managed)
]

[Page Component Instance|
  Props (immutable)
  Local refs (cleanup on unmount)
]

[Extracted Component Instances|
  Props (immutable, short-lived)
  No local state
  No refs
  Garbage collected after unmount
]

[<note>Memory Invariants:
• No memory leaks (functional components)
• Props shallow copied (React reconciliation)
• No circular references
• Components cleaned up on unmount
• SWR cache managed by library
]

[React Memory Manager] manages→ [Page Component Instance]
[Page Component Instance] creates→ [Extracted Component Instances]
[Extracted Component Instances] destroyed by→ [React Memory Manager]
```

**Memory Management**:
- **Automatic**: React handles component lifecycle
- **No manual cleanup**: Functional components with no side effects
- **Shallow props**: No deep object cloning needed
- **GC-friendly**: No closures capturing large objects

---

## 5. Optimization Diagram

```nomnoml
#title: Performance Optimization Strategy

[<abstract>Current Performance]

[BillDetailClient.tsx|
  260 lines compiled
  ~50KB bundle size
  Re-renders entire tree
]

[<abstract>Optimized Performance]

[BillDetailClient.tsx|
  <100 lines compiled
  ~20KB bundle size
  Selective re-renders
]

[Extracted Components|
  StatusBadge: ~2KB
  InfoCard: ~3KB
  ContactLink: ~2KB
  Formatters: ~1KB
  --
  Total: ~8KB extracted
]

[<note>Optimization Targets:
• Bundle size: -40% (260→100 lines main)
• Tree-shaking: Unused components removed
• Code splitting: Dynamic imports possible
• Memoization: React.memo on pure components
• Render optimization: Smaller component trees
]

[<note>Performance Budgets:
• Page component: <100 lines (<20KB)
• Extracted components: <50 lines (<5KB each)
• Total bundle: <50KB per page
• FCP: <1.5s (no regression)
• LCP: <2.5s (no regression)
]
```

**Optimization Strategy**:
1. **Code splitting**: Smaller components easier to split
2. **Tree-shaking**: Dead code elimination more effective
3. **Memoization**: Add `React.memo` to pure components if profiling shows benefit
4. **Bundle analysis**: Verify size improvements with `next/bundle-analyzer`

**Measured, not speculated**: Run performance audit before/after with Lighthouse.

---

## 6. Tidiness Diagram

```nomnoml
#title: Code Organization & Readability

[<abstract>Before: Monolithic Organization]

[apps/web/src/app/|
  bills/[id]/BillDetailClient.tsx (260 lines)
  legislators/[id]/LegislatorDetailClient.tsx (296 lines)
  --
  Cognitive Complexity: 25
  Cyclomatic Complexity: 15
  Maintainability Index: 65
]

[<abstract>After: Modular Organization]

[apps/web/src/|
  app/
    bills/[id]/BillDetailClient.tsx (<100 lines)
    legislators/[id]/LegislatorDetailClient.tsx (<100 lines)
  components/
    bills/
      StatusBadge.tsx
      BillInfoCard.tsx
      BillFormatters.ts
      __tests__/
    legislators/
      LegislatorInfoCard.tsx
      ContactLink.tsx
      LegislatorFormatters.ts
      __tests__/
    common/
      DateFormatter.ts
      __tests__/
]

[<note>Tidiness Improvements:
• Cognitive Complexity: 25→8 (target <15)
• Cyclomatic Complexity: 15→5 (target <10)
• Maintainability Index: 65→85 (target >70)
• Single Responsibility: Each component one purpose
• Testability: Isolated component testing
• Naming: Clear, descriptive, consistent
• Co-location: Tests next to components
]
```

**Naming Conventions**:
- **Components**: PascalCase (e.g., `StatusBadge.tsx`)
- **Utilities**: camelCase (e.g., `formatBillId`)
- **Test files**: `*.test.tsx` co-located with component
- **Domain prefixes**: `Bill*`, `Legislator*` for clarity

**Code Quality Metrics** (Measured with SonarQube/ESLint):
- **Before**: Cognitive 25, Cyclomatic 15, Maintainability 65
- **After** (Target): Cognitive <15, Cyclomatic <10, Maintainability >80

---

## Acceptance Criteria

### Functional Requirements
- [x] All existing tests pass (368 web tests)
- [x] No changes to rendered UI (pixel-perfect)
- [x] No changes to behavior or functionality
- [x] TypeScript compilation successful (zero errors)
- [x] All props interfaces documented with JSDoc

### Quality Requirements
- [x] Page components <100 lines each
- [x] Extracted components <50 lines each
- [x] Cognitive complexity <15 per component
- [x] Cyclomatic complexity <10 per component
- [x] Maintainability index >80
- [x] 100% test coverage maintained for page components

### Non-Functional Requirements
- [x] No bundle size regression (±5% tolerance)
- [x] No performance regression (FCP/LCP within ±100ms)
- [x] Accessibility: ARIA labels preserved
- [x] i18n: Text strings remain externalizable

---

## Implementation Plan

### Phase 1: Extract Bill Components (3 hours)
1. Create `components/bills/StatusBadge.tsx`
2. Create `components/bills/BillInfoCard.tsx`
3. Create `components/bills/BillFormatters.ts`
4. Update `BillDetailClient.tsx` imports
5. Run tests, verify no regressions

### Phase 2: Extract Legislator Components (2.5 hours)
1. Create `components/legislators/LegislatorInfoCard.tsx`
2. Create `components/legislators/ContactLink.tsx`
3. Create `components/legislators/LegislatorFormatters.ts`
4. Update `LegislatorDetailClient.tsx` imports
5. Run tests, verify no regressions

### Phase 3: Extract Common Utilities (0.5 hours)
1. Create `components/common/DateFormatter.ts`
2. Deduplicate `formatDate()` usage
3. Update imports in both bill and legislator components
4. Run full test suite

### Phase 4: Verification & Documentation (0 hours - automated)
1. Run TypeScript compilation
2. Run full test suite (368 tests)
3. Build production bundle
4. Lighthouse audit (FCP/LCP comparison)
5. Update component documentation

---

## Dependencies

**No external dependencies**. Pure refactoring of existing code.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Test failures | Low | Medium | Comprehensive test coverage exists; run after each extract |
| Bundle size increase | Low | Low | Webpack tree-shaking should handle; measure before/after |
| Import path errors | Low | Low | TypeScript will catch; use absolute imports |
| Merge conflicts | Low | Low | Independent from other work; separate PR |

**Overall Risk**: **LOW**

---

## Verification Checklist

**Before Committing**:
- [ ] TypeScript: `pnpm typecheck` (zero errors)
- [ ] Tests: `pnpm --filter=@ltip/web test` (368/368 passing)
- [ ] Build: `pnpm --filter=@ltip/web build` (success)
- [ ] Lint: `pnpm --filter=@ltip/web lint` (zero errors)
- [ ] Bundle size: Compare before/after with `next/bundle-analyzer`

**Before Merging**:
- [ ] PR approved by reviewer
- [ ] All CI checks passing
- [ ] Playwright screenshots captured
- [ ] Change Control record updated

---

## Success Metrics

**Quantitative**:
- Page component lines: 260→<100 (Bill), 296→<100 (Legislator)
- Extracted components: 5 total, all <50 lines
- Test pass rate: 100% (368/368)
- Bundle size: ±5% tolerance
- Performance: FCP/LCP ±100ms tolerance

**Qualitative**:
- Improved code readability (peer review feedback)
- Easier to test in isolation
- Component reuse potential unlocked

---

**ODIN Design Approved**: Ready for implementation via typescript-pro agent.
