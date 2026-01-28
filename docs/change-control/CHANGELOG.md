# Changelog

All notable changes to the LTIP (Legislative Tracking Intelligence Platform) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Congress.gov and OpenStates API integrations
- Authentication and authorization (JWT/OAuth)
- ML pipeline with BART, BERT, XGBoost (Phase 2)
- Neo4j influence network visualization (Phase 3)
- Kubernetes multi-region deployment (Phase 3)

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
| 0.4.0 | TBD | Phase 1 API complete |
| 0.5.0 | TBD | Phase 1 frontend MVP complete |
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
