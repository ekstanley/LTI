# LTIP Phase 1: MVP Implementation Plan

**Date**: 2026-01-28
**Phase**: 1 of 3
**Duration**: 8 weeks (33 working days)
**Methodology**: ODIN (Outline Driven INtelligence)

---

## Executive Summary

Phase 1 establishes the foundational infrastructure for the Legislative Tracking Intelligence Platform. This phase delivers a functional MVP with bill search, real-time voting via WebSocket, legislator profiles, and historical legislation database seeded from Congress 1-119.

### Phase 1 Objectives
- Scaffold monorepo with Next.js frontend and Express backend
- Establish PostgreSQL, Redis, and Elasticsearch infrastructure
- Integrate Congress.gov and OpenStates APIs for live data
- Implement WebSocket layer for real-time vote updates
- Build core UI: Bill Explorer, Bill Detail, Legislator Profiles
- Seed historical legislation database (Congress 1-119)

---

## Work Packages

### WP1: Project Scaffold
**Duration**: 3 days
**Dependencies**: None
**Risk Level**: LOW

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T1.1 | Initialize monorepo structure (Turborepo/Nx) | 0.5d | `npm run dev` starts all services | CI passes, all workspaces resolve |
| T1.2 | Scaffold Next.js 14 frontend with TypeScript | 0.5d | App renders at localhost:3000 | Lighthouse score >90 |
| T1.3 | Scaffold Express.js backend with TypeScript | 0.5d | Health endpoint returns 200 at :4000/health | Jest test passes |
| T1.4 | Create Docker Compose for local dev | 0.5d | `docker-compose up` starts all services | All containers healthy |
| T1.5 | Configure ESLint, Prettier, Husky | 0.5d | Pre-commit hooks run successfully | Lint passes on sample code |
| T1.6 | Set up CI/CD pipeline (GitHub Actions) | 0.5d | PR checks run automatically | Green build on main branch |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Turborepo version conflicts | LOW | LOW | 4 | Pin versions, use lockfile |

---

### WP2: Database Layer
**Duration**: 4 days
**Dependencies**: WP1
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T2.1 | Design PostgreSQL schema (bills, legislators, votes) | 1d | Schema matches MASTER_SPECIFICATION Section 9 | Migration runs without errors |
| T2.2 | Implement Prisma ORM with migrations | 0.5d | `npx prisma migrate dev` succeeds | Seed data inserts correctly |
| T2.3 | Configure Redis for caching layer | 0.5d | Redis connects, TTL works | Cache hit/miss metrics |
| T2.4 | Set up Elasticsearch indices | 1d | Bill search returns results <500ms | Query benchmark passes |
| T2.5 | Create database seeding scripts | 0.5d | Sample data loads in <60s | 1000 bills seeded |
| T2.6 | Implement connection pooling | 0.5d | Pool handles 100 concurrent connections | Load test passes |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Elasticsearch mapping conflicts | MEDIUM | MEDIUM | 9 | Version mappings, reindex scripts |
| Redis memory exhaustion | LOW | HIGH | 8 | Set maxmemory policy, monitor |

---

### WP3: Data Ingestion Pipeline
**Duration**: 5 days
**Dependencies**: WP2
**Risk Level**: HIGH

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T3.1 | Implement Congress.gov API client | 1d | Fetches bills, votes, members | Unit tests with mocked responses |
| T3.2 | Implement OpenStates API client | 1d | Fetches state bills, legislators | Unit tests with mocked responses |
| T3.3 | Create polling service (Bull/BullMQ) | 1d | Jobs execute on schedule | Job completion logs |
| T3.4 | Implement rate limiting and backoff | 0.5d | Respects API limits (1000/hr Congress.gov) | Rate limit test passes |
| T3.5 | Build data transformation layer | 1d | Raw API → normalized schema | Transform unit tests |
| T3.6 | Implement LegiScan fallback | 0.5d | Switches on Congress.gov failure | Failover integration test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| **R1: Congress.gov API Reliability** | HIGH | HIGH | 20 | LegiScan fallback, local cache, circuit breaker |
| API schema changes | MEDIUM | HIGH | 12 | Version pinning, schema validation |

---

### WP4: Core REST API
**Duration**: 5 days
**Dependencies**: WP2, WP3
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T4.1 | Implement `/api/v1/bills` endpoints | 1d | CRUD operations, pagination, filtering | Integration tests pass |
| T4.2 | Implement `/api/v1/legislators` endpoints | 1d | Member profiles, voting records | Integration tests pass |
| T4.3 | Implement `/api/v1/votes` endpoints | 0.5d | Roll call data, summaries | Integration tests pass |
| T4.4 | Add authentication middleware (JWT) | 0.5d | Protected routes require valid token | Auth test suite passes |
| T4.5 | Implement API rate limiting | 0.5d | 100 req/min per user enforced | Rate limit test passes |
| T4.6 | Add request validation (Zod) | 0.5d | Invalid requests return 400 | Validation tests pass |
| T4.7 | Implement response caching | 0.5d | Cache headers set correctly | Cache integration test |
| T4.8 | Add OpenAPI documentation | 0.5d | Swagger UI accessible at /api/docs | Docs render correctly |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| N+1 query performance | MEDIUM | MEDIUM | 9 | DataLoader pattern, query optimization |

---

### WP5: WebSocket Layer
**Duration**: 3 days
**Dependencies**: WP4
**Risk Level**: MEDIUM

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T5.1 | Set up Socket.io server | 0.5d | WebSocket connects at ws://localhost:4000 | Connection test passes |
| T5.2 | Implement room-based subscriptions | 0.5d | Clients subscribe to `bill:{billId}` | Subscription test passes |
| T5.3 | Build vote broadcast service | 1d | Vote updates push to subscribers <100ms | Latency benchmark |
| T5.4 | Add connection authentication | 0.5d | Only authenticated users connect | Auth rejection test |
| T5.5 | Implement reconnection handling | 0.5d | Auto-reconnect with exponential backoff | Disconnect/reconnect test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| WebSocket scaling | MEDIUM | MEDIUM | 9 | Redis adapter for horizontal scale |

---

### WP6: Frontend MVP
**Duration**: 8 days
**Dependencies**: WP4, WP5
**Risk Level**: LOW

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T6.1 | Set up TailwindCSS and component library | 0.5d | Styled components render correctly | Visual regression baseline |
| T6.2 | Implement global state (Zustand) | 0.5d | State persists across navigation | State persistence test |
| T6.3 | Set up React Query for data fetching | 0.5d | Queries cache and refetch correctly | Query cache test |
| T6.4 | Build Bill Explorer page (search, filter, list) | 2d | Search returns results <200ms | E2E test passes |
| T6.5 | Build Bill Detail page (summary, status, votes) | 2d | All bill data displays correctly | E2E test passes |
| T6.6 | Build Legislator Profile page | 1.5d | Voting record, bio, contact displays | E2E test passes |
| T6.7 | Integrate WebSocket for live votes | 0.5d | Vote count updates in real-time | Live update test |
| T6.8 | Build Dashboard with trending bills | 0.5d | Dashboard loads <2s | Performance test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| Component library conflicts | LOW | LOW | 4 | Use shadcn/ui, test early |

---

### WP7: Historical Data Loading
**Duration**: 5 days
**Dependencies**: WP2, WP3
**Risk Level**: HIGH

#### Tasks

| ID | Task | Effort | Acceptance Criteria | Testable Deliverable |
|----|------|--------|---------------------|---------------------|
| T7.1 | Design historical_bills schema | 0.5d | Matches MASTER_SPECIFICATION | Migration runs |
| T7.2 | Build Congress archives scraper | 1.5d | Fetches Congress 1-119 data | Scraper unit tests |
| T7.3 | Implement batch import pipeline | 1d | Imports 500k+ bills without OOM | Memory profiling |
| T7.4 | Create case law index (Google Scholar, Cornell LII) | 1d | Supreme Court cases indexed | Search returns cases |
| T7.5 | Build historical matching service | 1d | Similar bills returned via embeddings | Similarity test |

#### Risks
| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
| **R2: Historical Data Volume** | HIGH | MEDIUM | 16 | Stream processing, chunked imports, progress checkpoints |
| Archive API availability | MEDIUM | MEDIUM | 9 | Mirror critical data locally |

---

## Dependency Graph

```
[WP1: Scaffold] ──┬──> [WP2: Database] ──┬──> [WP3: Ingestion] ──> [WP7: Historical]
                  │                      │
                  │                      └──> [WP4: REST API] ──> [WP5: WebSocket]
                  │                                                      │
                  └──────────────────────────────────────────────────────┴──> [WP6: Frontend]
```

---

## Risk Matrix Summary

| ID | Risk | Probability | Impact | Score | Priority |
|----|------|-------------|--------|-------|----------|
| R1 | Congress.gov API Reliability | HIGH | HIGH | 20 | CRITICAL |
| R2 | Historical Data Volume | HIGH | MEDIUM | 16 | HIGH |
| R3 | Elasticsearch mapping conflicts | MEDIUM | MEDIUM | 9 | MEDIUM |
| R4 | WebSocket scaling | MEDIUM | MEDIUM | 9 | MEDIUM |
| R5 | N+1 query performance | MEDIUM | MEDIUM | 9 | MEDIUM |

---

## Phase 1 Exit Criteria

- [ ] All 24 tasks completed and tested
- [ ] API response time <200ms (p95)
- [ ] WebSocket latency <100ms for vote updates
- [ ] Historical database seeded with Congress 1-119
- [ ] Bill search returns results <500ms
- [ ] Zero critical security vulnerabilities
- [ ] Test coverage >70% on critical paths
- [ ] Documentation complete for all public APIs

---

## Effort Summary

| Work Package | Days | Tasks |
|--------------|------|-------|
| WP1: Project Scaffold | 3 | 6 |
| WP2: Database Layer | 4 | 6 |
| WP3: Data Ingestion | 5 | 6 |
| WP4: Core REST API | 5 | 8 |
| WP5: WebSocket Layer | 3 | 5 |
| WP6: Frontend MVP | 8 | 8 |
| WP7: Historical Data | 5 | 5 |
| **Total** | **33** | **44** |

---

## Appendix: Technology Decisions

### Why Turborepo over Nx?
- Simpler configuration for TypeScript monorepos
- Better incremental build caching
- Lower learning curve

### Why Prisma over TypeORM?
- Type-safe schema-first approach
- Better migration tooling
- Excellent TypeScript integration

### Why Socket.io over ws?
- Built-in reconnection handling
- Room-based subscriptions out of box
- Redis adapter for horizontal scaling

### Why Zustand over Redux?
- Minimal boilerplate
- Excellent TypeScript support
- Simpler mental model for MVP scope
