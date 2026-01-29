# Changelog

All notable changes to the LTIP (Legislative Tracking Intelligence Platform) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- **WP6-R (Frontend Completion)**: Connect bills page to API, add legislators/votes pages
- **WP3-A (Data Ingestion Core)**: Congress.gov API client with rate limiting
- **WP7-A (Historical Data Load)**: Bulk import Congress 118-119 data
- Authentication and authorization (JWT/OAuth)
- ML pipeline with BART, BERT, XGBoost (Phase 2)
- Neo4j influence network visualization (Phase 3)
- Kubernetes multi-region deployment (Phase 3)

---

## [0.5.1] - 2026-01-28

### Added
- **Phase 1 Gap Analysis (docs/plans/2026-01-28-phase1-gap-analysis.md)**:
  - Comprehensive assessment of Phase 1 completion status (68%)
  - Work package status: WP1-WP5 complete, WP3/WP6/WP7 remaining
  - Risk assessment with mitigation strategies
  - Exit criteria verification table
- **Remaining Work Packages (docs/plans/2026-01-28-phase1-remaining-workpackages.md)**:
  - WP6-R: Frontend Completion (2-3 days, 10 acceptance criteria)
  - WP3-A: Data Ingestion Core (3-4 days, 10 acceptance criteria)
  - WP7-A: Historical Data Load (2-3 days, 10 acceptance criteria)
  - Architecture diagrams for ingestion pipeline
  - Detailed effort estimates with confidence levels
  - Execution schedule with critical path analysis

### Fixed
- TypeScript test mock types aligned with Prisma schema definitions
- `BillTextVersion.textHash` changed from nullable to required in tests
- `BillTextVersion.textFormat` uses `as const` assertion for enum type
- Legislator service tests use correct `getSponsorshipStats` return type
- Removed unused `billRepository` import from legislator service tests

### Technical Details
- Total tests: 171 passing (9 test files)
- Test categories: Mapper (98), Service (25), WebSocket (48)
- Build status: All packages build successfully

---

## [0.5.0] - 2026-01-28

### Added
- **WebSocket Server (apps/api/src/websocket)**:
  - Room-based pub/sub subscription manager (`room-manager.ts`)
  - Bidirectional client↔room tracking for efficient cleanup
  - Topic validation: `bill:{id}` and `vote:{id}` formats
  - Connection lifecycle management with client IDs
- **Vote Broadcast Service (apps/api/src/websocket/broadcast.service.ts)**:
  - `emitVoteUpdate()`: Individual legislator vote broadcasts
  - `emitTallyUpdate()`: Running tally count broadcasts
  - `emitBillStatusChange()`: Bill status transition broadcasts
  - `emitVoteWithTally()`: Combined vote + tally convenience method
  - Dual-room broadcasting (vote room + bill room)
- **WebSocket Authentication (apps/api/src/websocket/auth.ts)**:
  - JWT token extraction from query string (`?token=xxx`)
  - JWT token extraction from Sec-WebSocket-Protocol header
  - Token format validation (3-part base64url structure)
  - User ID extraction from `sub` or `userId` claims
  - MVP: Format validation only (signature verification in Phase 2)
- **Heartbeat and Connection Management**:
  - 30-second ping/pong heartbeat interval
  - Automatic stale connection cleanup
  - Graceful shutdown with client notification
- **Health Endpoints**:
  - GET `/health/ws`: WebSocket statistics (connected count, rooms, subscriptions)
  - Version bump to 0.5.0 in health response
- **WebSocket Type System (apps/api/src/websocket/types.ts)**:
  - Client messages: subscribe, unsubscribe, ping
  - Server messages: connection:established, subscribed, unsubscribed, pong, error
  - ExtendedWebSocket interface with clientId, userId, isAlive metadata
  - Error code constants: INVALID_MESSAGE, INVALID_TOPIC, UNAUTHORIZED, RATE_LIMITED
- **Unit Tests (apps/api/src/__tests__/websocket)**:
  - Room manager tests: 21 tests covering subscribe/unsubscribe/cleanup
  - Auth tests: 17 tests for token extraction and validation
  - Broadcast service tests: 10 tests for event structure and routing
  - Total: 48 new WebSocket-specific tests

### Changed
- Updated WebSocket server to use room manager for subscriptions
- Integrated authentication check on WebSocket upgrade
- Updated Unreleased section to reflect completed WebSocket work

### Technical Details
- exactOptionalPropertyTypes compliance with conditional spread pattern
- vi.mock hoisting pattern for Vitest module mocking
- Zero external dependencies for WebSocket (native `ws` library)
- Estimated bundle impact: ~50KB (vs ~300KB for Socket.io alternative)

---

## [0.4.0] - 2026-01-28

### Added
- **DTO Mappers (apps/api/src/mappers)**:
  - Type-safe Prisma-to-API transformations
  - `bill.mapper.ts`: Bill summary and detail transformations
  - `legislator.mapper.ts`: Legislator and committee membership mapping
  - `vote.mapper.ts`: Roll call votes, positions, party breakdown
  - `enums.ts`: Bidirectional enum conversions (BillType, Chamber, Party, Status)
  - Comprehensive type assertions for API response formats
  - Field transformations: UPPERCASE to lowercase, dates to ISO strings
- **Service Layer (apps/api/src/services)**:
  - Business logic abstraction over repositories
  - `bill.service.ts`: Bill listing, search, filtering, cosponsors
  - `legislator.service.ts`: Legislator list, stats, votes, committees
  - `vote.service.ts`: Roll call votes, individual votes, party breakdown
  - `committee.service.ts`: Committee hierarchy, memberships
  - API filter-to-repository parameter conversion
  - Offset-to-page pagination conversion
- **API Route Wiring**:
  - Bills routes connected to bill service with real Prisma data
  - Legislators routes with search, stats, votes, committees
  - Votes routes with roll calls and party breakdown
  - Committees routes with hierarchy and members
  - Health routes with proper TypeScript inference
- **Committees Route (apps/api/src/routes/committees.ts)**:
  - GET `/committees` - List committees with chamber filter
  - GET `/committees/:id` - Committee details with members
  - GET `/committees/:id/bills` - Bills referred to committee
  - Zod validation for all request parameters
- **Unit Tests (apps/api/src/__tests__)**:
  - Mapper unit tests: 57 tests covering all enum and object transformations
  - Service unit tests: 25 tests for bill and legislator services
  - Vitest with mock repository pattern
  - Test coverage for search, filtering, pagination, edge cases

### Changed
- Updated apps/api/src/routes to use service layer instead of stubs
- Removed placeholder data from route handlers
- Updated route type annotations for TypeScript portability

### Technical Details
- Total tests: 123 passing
- Separation of concerns: routes → services → repositories → Prisma
- Consistent error handling with ApiError class
- exactOptionalPropertyTypes compliance with conditional spreads

---

## [0.3.0] - 2026-01-28

### Added
- **Prisma Schema (apps/api/prisma)**:
  - Complete data model for legislative tracking (24 models)
  - Congress, Bill, Legislator, RollCallVote, Committee models
  - Amendment, BillAction, BillTextVersion, CommitteeReferral models
  - LegislatorPartyHistory, PolicyArea, Subject models
  - Optimized indexes for query patterns
  - Composite unique constraints for data integrity
  - Support for bill types, statuses, party affiliations, chambers
- **Database Layer (apps/api/src/db)**:
  - Prisma client singleton with connection pooling
  - Automatic retry logic with exponential backoff (5 retries)
  - Health check and graceful shutdown utilities
  - In-memory cache fallback when Redis unavailable
  - Key namespacing for cost-efficient single Redis instance
  - Configurable TTLs: cache (5min), search (1min), session (24h)
- **Repository Layer (apps/api/src/repositories)**:
  - BaseRepository with cache-aside pattern
  - Pagination utilities (offset and cursor-based)
  - Generic sorting with type-safe field validation
  - BillRepository: full-text search, filtering, sponsor queries
  - LegislatorRepository: search, voting stats, sponsorship stats
  - VoteRepository: roll call votes, party breakdown, comparison
  - CommitteeRepository: hierarchy, memberships, bill referrals
- **Full-Text Search**:
  - PostgreSQL tsvector/tsquery for bills and legislators
  - SQL trigger functions for automatic search vector updates
  - Weighted search (title:A, summary:B, text:C)
  - Ranked results with ts_rank scoring
- **Database Migrations (apps/api/prisma/migrations)**:
  - Initial schema migration with all models
  - Full-text search triggers migration
  - Comprehensive README with migration guidelines
- **Seed Data (apps/api/prisma/seed.ts)**:
  - Development seed script with realistic data
  - 118th Congress with sample bills
  - Sample legislators from both parties
  - Committee structure with memberships
  - Roll call votes with individual positions
- **Design Documentation**:
  - Database layer design document with architecture diagrams
  - Cost optimization strategy ($0-40/month target)
  - Performance considerations and caching strategy

### Changed
- Updated apps/api/package.json with Prisma dependencies
- Removed "Database schema implementation with Prisma" from Planned (completed)

### Infrastructure
- PostgreSQL 16 full-text search integration
- In-memory cache for zero-cost development without Redis
- Connection pool management for production readiness

---

## [0.2.0] - 2026-01-28

### Added
- **Monorepo Structure**: Turborepo with pnpm workspaces
- **Frontend Scaffold (apps/web)**:
  - Next.js 14.2.21 with App Router and Server Components
  - Tailwind CSS with custom political spectrum color palette
  - UI components: Badge, Card, Skeleton, BiasSpectrum, BillCard
  - Type-safe API client with SWR for data fetching
  - Home page with hero, features, and statistics sections
  - Bills listing page with search/filter UI
- **Backend Scaffold (apps/api)**:
  - Express.js 4.21.2 with TypeScript
  - Zod-validated environment configuration
  - Pino structured logging with pretty printing (dev mode)
  - Rate limiting middleware with configurable thresholds
  - API routes: bills, legislators, votes, analysis, conflicts
  - WebSocket server for real-time vote updates
  - Health check endpoints for container orchestration
- **Shared Packages (packages/shared)**:
  - Shared TypeScript types for Bill, Legislator, Vote, Analysis
  - Utility functions: formatBillId, getBiasLabel, formatRelativeTime
  - Constants: bill statuses, party colors, chamber types, US states
  - ESLint, Prettier, and TypeScript configurations
- **Infrastructure**:
  - Docker Compose with PostgreSQL 16, Redis 7 services
  - Multi-stage Dockerfiles for API and Web (dev/prod targets)
  - Health checks ensuring correct service startup order
- **CI/CD Pipeline**:
  - GitHub Actions workflow with lint, typecheck, build, test jobs
  - Parallel job execution with dependency management
  - Docker build verification on main branch pushes
  - Test job with PostgreSQL and Redis service containers
- **Documentation Pipeline**:
  - Automatic PDF generation from Enhanced Markdown
  - Pandoc + XeLaTeX for professional PDF output
  - Workflow triggered on docs/**/*.md changes
  - Auto-commit generated PDFs to repository

### Changed
- AGENTS.md updated with Enhanced Markdown + PDF generation rules
- Updated project structure from planning to implementation phase

### Infrastructure
- Docker Compose: PostgreSQL 16-alpine, Redis 7-alpine
- Environment configuration via .env.example template
- pnpm 10 with frozen lockfile enforcement

---

## [0.1.0] - 2026-01-28

### Added
- Project initialization
- MASTER_SPECIFICATION.md (2,297 lines comprehensive spec)
- AGENTS.md AI agent quick-reference guide
- Implementation plans for all 3 phases
- Change control documentation

### Documentation
- Created docs/plans/ directory structure
- Created docs/change-control/ directory structure

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-01-28 | Initial planning and documentation |
| 0.2.0 | 2026-01-28 | Phase 1 MVP scaffold complete |
| 0.3.0 | 2026-01-28 | Phase 1 data layer complete |
| 0.4.0 | 2026-01-28 | Phase 1 API layer complete |
| 0.5.0 | 2026-01-28 | Phase 1 WebSocket layer complete |
| 0.5.1 | 2026-01-28 | Phase 1 gap analysis and work packages defined |
| 1.0.0 | TBD | Phase 1 complete - MVP release |
| 1.1.0 | TBD | Phase 2 ML infrastructure complete |
| 1.2.0 | TBD | Phase 2 analysis models complete |
| 1.3.0 | TBD | Phase 2 analysis UI complete |
| 2.0.0 | TBD | Phase 2 complete - Analysis release |
| 2.1.0 | TBD | Phase 3 influence network complete |
| 2.2.0 | TBD | Phase 3 advanced analytics complete |
| 3.0.0 | TBD | Phase 3 complete - Production release |

---

## Change Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes
- **Performance**: Performance improvements
- **Documentation**: Documentation changes
- **Infrastructure**: Infrastructure and deployment changes
