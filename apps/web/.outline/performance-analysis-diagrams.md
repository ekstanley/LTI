# LTI Web Application Performance Analysis - Diagrams

**Date**: 2026-01-31
**Analyst**: ODIN Performance Engineer
**Scope**: Next.js 14 Frontend + Express API Backend

---

## 1. Current Architecture with Bottlenecks

```nomnoml
#direction: right
#spacing: 40
#padding: 20

[<actor>User]
[User] -> [Next.js 14 Frontend|
  Port 3012|
  SSR + Client Components|
  Bundle: 119MB (dev)]

[Next.js 14 Frontend] -> [API Client (api.ts)|
  1013 LOC|
  BOTTLENECK: Complex retry logic|
  Max 3 retries × backoff|
  CSRF token overhead|
  Gap 4.1: Missing AbortSignal]

[API Client (api.ts)] -> [Express API|
  Port 4000|
  Prisma + PostgreSQL|
  Redis (ioredis)]

[Next.js 14 Frontend] -- [SWR Cache|
  5s deduping interval|
  BOTTLENECK: Too aggressive|
  for static data]

[Next.js 14 Frontend] contains [VotesPageClient|
  425 LOC|
  BOTTLENECK: 30s polling|
  Potential memory leak|
  Hydration errors]

[Next.js 14 Frontend] contains [BillsPageClient|
  217 LOC|
  300ms debounce|
  Good performance]

[Next.js 14 Frontend] contains [Icon Imports|
  14 files|
  lucide-react|
  BOTTLENECK: No tree-shaking]
```

---

## 2. Data Flow with Performance Metrics

```nomnoml
#direction: down
#spacing: 30

[User Action] -> [Client Component]
[Client Component] -> [SWR Hook|
  useBills()|
  useVotes()|
  useLegislators()]

[SWR Hook] cache-> [Cache Check|
  5s deduping|
  PROBLEM: Too short]

[Cache Check] hit-> [Return Cached|
  Target: <50ms|
  Current: ~20ms ✓]

[Cache Check] miss-> [API Client|
  fetcher() function|
  1013 lines]

[API Client] -> [Validation Layer|
  validateQueryParams()|
  validateId()|
  Cost: ~5-10ms]

[Validation Layer] -> [Network Request|
  Target: <200ms p95|
  Current: Unknown|
  NEEDS MEASUREMENT]

[Network Request] retry-> [Retry Logic|
  Max 3 attempts|
  Exponential backoff|
  WORST CASE: 30s+|
  PROBLEM: Too aggressive]

[Network Request] success-> [Response Processing|
  JSON parsing|
  CSRF rotation|
  Cost: ~10-20ms]

[Response Processing] -> [SWR Cache Update]
[SWR Cache Update] -> [Component Re-render|
  Target: <16ms (60fps)|
  NEEDS MEASUREMENT]
```

---

## 3. Memory Management & Leak Risks

```nomnoml
#direction: right
#spacing: 40

[Component Mount] -> [VotesPageClient]

[VotesPageClient] creates-> [Polling Interval|
  setInterval 30s|
  RISK: Memory leak]

[Polling Interval] stores-> [mutateRef|
  useRef hook|
  Updated on mutate change]

[VotesPageClient] cleanup?-> [useEffect Cleanup|
  clearInterval()|
  STATUS: Present ✓|
  Line 249]

[Polling Interval] calls-> [SWR mutate()|
  Revalidation trigger|
  Network request]

[SWR mutate()] -> [Network Stack|
  Potential accumulation|
  if requests slow]

[Component Mount] also-> [Filter State|
  3 state objects|
  Memory: ~1KB ✓]

[Component Mount] also-> [Page State|
  Simple number|
  Memory: Minimal ✓]

[RISK ASSESSMENT|
  HIGH: Polling without backpressure|
  MEDIUM: Concurrent requests|
  LOW: State management|
  MITIGATION NEEDED]
```

---

## 4. Optimization Roadmap

```nomnoml
#direction: down
#spacing: 30
#lineWidth: 2

[Current State|
  API Response: Unknown|
  Bundle: 119MB (dev)|
  Memory: Leak risk|
  Cache: 5s deduping] -> [Phase 1: Quick Wins|
  PRIORITY: HIGH|
  EFFORT: Low|
  IMPACT: Medium-High]

[Phase 1: Quick Wins] contains [Opt 1.1: Icon Tree-Shaking|
  Import individual icons|
  Bundle reduction: ~100-200KB|
  Effort: 2 hours]

[Phase 1: Quick Wins] contains [Opt 1.2: SWR Cache Tuning|
  Increase deduping to 60s|
  Add revalidateOnMount: false|
  Effort: 1 hour]

[Phase 1: Quick Wins] contains [Opt 1.3: Production Build|
  Enable minification|
  Expected reduction: 60-70%|
  Effort: 30 minutes]

[Phase 1: Quick Wins] -> [Phase 2: Core Optimizations|
  PRIORITY: HIGH|
  EFFORT: Medium|
  IMPACT: High]

[Phase 2: Core Optimizations] contains [Opt 2.1: API Client Simplification|
  Reduce max retries to 1|
  Add request timeout 5s|
  Fix AbortSignal propagation|
  Lines: 731-800, 854-856|
  Effort: 4 hours]

[Phase 2: Core Optimizations] contains [Opt 2.2: Polling Backpressure|
  Add request queue|
  Skip poll if previous pending|
  Lines: 237-250|
  Effort: 3 hours]

[Phase 2: Core Optimizations] contains [Opt 2.3: Code Splitting|
  Dynamic imports for pages|
  Lazy load heavy components|
  Effort: 4 hours]

[Phase 2: Core Optimizations] -> [Phase 3: Advanced|
  PRIORITY: Medium|
  EFFORT: High|
  IMPACT: Medium]

[Phase 3: Advanced] contains [Opt 3.1: WebSocket Upgrade|
  Replace polling|
  Real-time updates|
  Effort: 16 hours]

[Phase 3: Advanced] contains [Opt 3.2: CDN + Edge Caching|
  Static asset optimization|
  Effort: 8 hours]

[Phase 3: Advanced] contains [Opt 3.3: Database Query Optimization|
  Add indexes|
  Query analysis|
  Effort: 12 hours]
```

---

## 5. Concurrency & Polling Analysis

```nomnoml
#direction: right
#spacing: 40

[VotesPageClient Mount|
  t=0s]

[VotesPageClient Mount] -> [Initial Data Fetch|
  t=0s|
  SWR automatic]

[Initial Data Fetch] -> [Polling Timer Start|
  t=0s|
  setInterval 30s]

[Polling Timer Start] -> [Poll Request 1|
  t=30s|
  Duration: Unknown]

[Poll Request 1] slow?-> [Slow Response Scenario|
  Duration: 25s|
  PROBLEM: Accumulation]

[Poll Request 1] -> [Poll Request 2|
  t=60s|
  Regardless of previous]

[Slow Response Scenario] overlap-> [Poll Request 2|
  RISK: 2 concurrent requests|
  Network congestion]

[Poll Request 2] -> [Poll Request 3|
  t=90s|
  WORST CASE: 3 concurrent]

[MITIGATION NEEDED|
  Add request tracking|
  Skip if pending|
  Add timeout|
  Add exponential backoff on errors]

[User Navigates Away] -> [Component Unmount]
[Component Unmount] cleanup-> [clearInterval()|
  Line 249|
  STATUS: Present ✓]
```

---

## 6. Bundle Size Breakdown (Estimated)

```nomnoml
#direction: down
#spacing: 25

[Total Bundle (dev)|
  119MB|
  TARGET: <500KB gzipped]

[Total Bundle (dev)] contains [Next.js Framework|
  ~40-50MB|
  Cannot optimize much]

[Total Bundle (dev)] contains [React + React-DOM|
  ~2-3MB|
  Cannot optimize]

[Total Bundle (dev)] contains [SWR|
  ~15KB gzipped|
  Optimal ✓]

[Total Bundle (dev)] contains [Application Code|
  api.ts: 1013 LOC|
  Components: ~2000 LOC|
  OPTIMIZATION TARGET]

[Total Bundle (dev)] contains [lucide-react|
  Entire library loaded?|
  PROBLEM: No tree-shaking|
  Size: ~600KB uncompressed|
  OPTIMIZATION: Import specific icons]

[Total Bundle (dev)] contains [Development Artifacts|
  HMR|
  Source maps|
  ~30-40MB|
  Removed in production ✓]

[Production Build Estimate|
  Without optimization: ~2-3MB|
  With optimization: ~800KB-1.2MB|
  Gzipped: ~250-400KB|
  TARGET: <500KB ✓]
```

---

## Performance Targets vs Current State

| Metric | Target | Current | Status | Priority |
|--------|--------|---------|--------|----------|
| API Response (p95) | <200ms | Unknown | ⚠️ Needs measurement | HIGH |
| Frontend Load | <3s | Unknown | ⚠️ Needs measurement | HIGH |
| Bundle Size (gzipped) | <500KB | Unknown (dev: 119MB) | ⚠️ Build needed | HIGH |
| Memory Leaks | 0 | Potential in polling | ⚠️ Fix needed | MEDIUM |
| Database Queries | Optimized | Unknown | ⚠️ Analysis needed | MEDIUM |
| Uptime | 99.9% | N/A | N/A | N/A |

