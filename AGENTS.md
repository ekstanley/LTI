# AGENTS.md - Legislative Tracking Intelligence Platform

**Status**: Greenfield project (specification complete, implementation pending)
**Specification**: See `MASTER_SPECIFICATION.md` for complete technical details

---

## Master Rules

> **MANDATORY**: These rules apply to all AI agents and contributors working on this project.

### Documentation Standards

1. **All documentation** in `docs/` shall be authored in **Enhanced Markdown** with:
   - GitHub Flavored Markdown (GFM) syntax
   - LaTeX math notation where applicable (`$E=mc^2$`, `$$\sum_{i=1}^n x_i$$`)
   - Mermaid diagrams for visualizations
   - Proper tables, code blocks with syntax highlighting

2. **PDF Generation**: A CI pipeline auto-generates PDF versions to `docs/pdf/` on commit
   - Local generation: `pnpm docs:pdf`
   - Word export: `pnpm docs:word`

3. **Exceptions**: This file (`AGENTS.md`) and `CLAUDE.md` are excluded from PDF generation

4. **File Naming**: `YYYY-MM-DD-<descriptive-name>.md` for plans and change control documents

### Monorepo Structure

```
apps/
  web/          # Next.js 14 frontend
  api/          # Express.js backend
packages/
  shared/       # Shared types, utilities
  eslint-config/# Shared ESLint configuration
  tsconfig/     # Shared TypeScript configuration
docs/
  plans/        # Implementation plans (.md)
  pdf/          # Auto-generated PDFs
  change-control/
```

---

## Project Overview

A comprehensive legislative intelligence platform providing neutral analysis of federal and state legislation with real-time voting data, ML-based predictions, financial conflict detection, and historical legal context.

**Key Differentiators**:
- Multi-perspective analysis (left/center/right) with bias detection
- Historical legislation matching with outcome verification
- Supreme Court case law linking
- Real-time voting via WebSocket
- Financial conflict-of-interest detection

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+, React 18, TypeScript, Zustand, React Query, D3.js, Mapbox GL, Socket.io-client, TailwindCSS |
| Backend | Express.js (or FastAPI), Node.js 18+ (or Python 3.11+), TypeScript, Socket.io |
| Primary DB | PostgreSQL 15+ |
| Cache | Redis 7+ |
| Search | Elasticsearch 8+ |
| Graph (optional) | Neo4j |
| ML/AI | Python 3.11+, BERT/RoBERTa, BART, XGBoost, sentence-transformers |
| Infrastructure | Docker, Kubernetes, AWS/GCP/Azure |

---

## Architecture (Seven Layers)

```
PRESENTATION (Next.js)
    |
API (Express/FastAPI + WebSocket)
    |
CACHE (Redis: metadata TTL 1h, votes real-time, analysis TTL 7d)
    |
DATA (PostgreSQL + Elasticsearch)
    |
ANALYSIS (ML Services)
    |
INGESTION (Polling + Message Queue)
    |
INFRASTRUCTURE (Kubernetes)
```

---

## External Data Sources (Critical)

### Legislative Data (FREE)
- **Congress.gov API**: Bills, votes, members (poll: votes 30min, bills 6h)
- **OpenStates API**: State bills, votes, legislators (poll: hourly)
- **LegiScan API**: Backup/redundancy

### Financial Data (FREE)
- **House.gov / Senate.gov**: Financial disclosures
- **FEC.gov**: Campaign contributions

### Legal/Historical Data (FREE)
- **Congress.gov Archives**: Historical bills (Congress 1-119)
- **Google Scholar API**: Supreme Court opinions
- **Cornell LII**: Case law text
- **GAO / CBO**: Outcomes reports

### Regulatory Data (FREE)
- **Federal Register (govinfo.gov)**: Proposed/final rules, timelines

---

## Core Database Tables

```
bills                      - Current legislation
historical_bills           - Congress 1-119 with outcomes
legislators                - Member profiles
votes / legislator_votes   - Roll call data
bill_analysis              - ML-generated summaries, bias, predictions
financial_disclosures      - Stock holdings, employment
conflict_of_interest_flags - COI detection results
case_law_index             - Supreme Court linkages
legislation_outcomes       - Predicted vs actual impact data
```

---

## ML Pipeline Components

| Component | Model | Input | Output |
|-----------|-------|-------|--------|
| Summarization | BART | Bill text | Neutral 150-word summary |
| Bias Detection | BERT ensemble | Bill text | Score -1 to +1, confidence |
| Passage Prediction | XGBoost | 25+ features | Probability 0-1 |
| Impact Estimation | Ensemble | Bill + similar bills | Fiscal/population impact |
| COI Detection | Rule-based + ML | Disclosures + bill | Conflict flags |
| Historical Matching | sentence-transformers | Bill embeddings | Similar bills list |

---

## API Design Patterns

### REST Endpoints
```
GET /api/v1/bills?q=&status=&chamber=&limit=&offset=
GET /api/v1/bills/{billId}
GET /api/v1/bills/{billId}/analysis?include_historical=true
GET /api/v1/bills/{billId}/historical-matches
GET /api/v1/bills/{billId}/case-law
GET /api/v1/legislators/{memberId}
GET /api/v1/legislators/{memberId}/financial-disclosures
GET /api/v1/votes/{billId}/summary
```

### WebSocket Events
```javascript
socket.emit('subscribe', { channel: 'bill:{billId}' })
socket.on('vote:update', data)      // Individual vote recorded
socket.on('tally:update', data)     // Vote count updated
socket.on('bill:status_change', data)
```

### Rate Limits
- REST: 100 req/min per user
- WebSocket: 1000 events/min per connection

---

## Development Commands

```bash
# Development (Turborepo)
pnpm dev                 # Start all services (frontend + backend)
pnpm dev --filter=web    # Next.js dev server only (port 3000)
pnpm dev --filter=api    # Express server only (port 4000)

# Docker Infrastructure
docker-compose up -d     # Start infrastructure (Postgres, Redis, ES)
docker-compose down      # Stop services
docker-compose logs -f   # View logs

# Database
pnpm db:migrate          # Run migrations
pnpm db:seed             # Seed historical data
pnpm db:reset            # Reset database

# ML Pipeline
python -m ml.train       # Train models
python -m ml.ingest      # Run data ingestion

# Testing
pnpm test                # Run all test suites
pnpm test --filter=web   # Frontend tests only
pnpm test --filter=api   # Backend tests only
pnpm test:e2e            # End-to-end tests

# Build & Quality
pnpm build               # Production build (all packages)
pnpm typecheck           # TypeScript validation
pnpm lint                # ESLint + Prettier check
pnpm lint:fix            # Auto-fix linting issues

# Documentation
pnpm docs:pdf            # Generate PDFs from docs/*.md
pnpm docs:word           # Generate Word docs from docs/*.md
```

---

## Key Implementation Notes

### Historical Context Toggle
The `include_historical` parameter is critical for improved prediction accuracy (+15%). When enabled:
1. Queries `historical_bills` for similar legislation
2. Retrieves `legislation_outcomes` for actual vs predicted impact
3. Links relevant `case_law_index` entries
4. Adjusts confidence scores based on historical validation

### Vote Polling Strategy
- Active bills: Poll every 30 minutes
- Floor votes in progress: Poll every 1 minute
- Broadcast via WebSocket on change detection
- Cache in Redis with real-time TTL

### Bias Detection Ensemble
Four independent methods combined:
1. Lexical keyword analysis
2. BERT classification
3. Semantic similarity to political frameworks
4. Entity political lean matching

Final score = weighted average; confidence = inverse of variance

### COI Detection Priority
Check in order (highest severity first):
1. Stock holdings in affected companies
2. Family employment at affected entities
3. Lobbying contacts from affected industries
4. Campaign donations from affected sectors

---

## Polling Intervals

| Data Type | Interval |
|-----------|----------|
| Federal votes | 30 min (1 min during active floor votes) |
| Federal bills | 6 hours |
| State bills | 1 hour |
| Regulations | Daily |
| Case law | Weekly |
| Outcomes data | Monthly |

---

## Performance Targets

- API response: <200ms (p95)
- Database query: <100ms (p95)
- Search index: <500ms (p95)
- Page load: <2s (p95)
- Uptime: 99.9%
- Passage prediction accuracy: 78%+

---

## Phase Implementation Order

1. **MVP (Weeks 1-8)**: Bill search, real-time voting, legislator profiles, historical DB loaded
2. **Analysis (Weeks 9-16)**: ML summaries, bias detection, predictions, historical matching
3. **Intelligence (Weeks 17-24)**: Influence networks, long-term tracking, international comparison

---

## AI Agent Capabilities (ODIN Framework)

> **Last Updated**: 2026-01-29 (WP8 Historical Data Execution - Votes Import 100% COMPLETE: 1117 votes)

This section documents the AI capabilities available for LTIP development. Use these agents, skills, and tools to accelerate development while maintaining quality.

### Specialized Development Agents

Launch via `Task` tool with `subagent_type` parameter. Agents run autonomously and return results.

#### Code Quality & Review

| Agent | Use Case |
|-------|----------|
| `odin:code-reviewer` | Expert code review (quality, security, maintainability) |
| `odin:security-auditor` | Security vulnerabilities, OWASP compliance, auth flows |
| `odin:typescript-pro` | Advanced TypeScript patterns, type safety, generics |
| `odin:javascript-pro` | ES6+, async patterns, Node.js optimization |
| `odin:python-pro` | Python optimization, testing, async |
| `odin:database-optimizer` | SQL optimization, indexes, N+1 problems |
| `everything-claude-code:code-reviewer` | Comprehensive code review with style guide adherence |
| `pr-review-toolkit:code-reviewer` | PR-specific review for guidelines compliance |
| `pr-review-toolkit:silent-failure-hunter` | Find silent failures, inadequate error handling |

#### Architecture & Planning

| Agent | Use Case |
|-------|----------|
| `odin:architect` | System architecture, technical decisions |
| `odin:backend-architect` | Backend systems, API design, service architecture |
| `feature-dev:code-architect` | Feature implementation blueprints |
| `everything-claude-code:planner` | Step-by-step implementation plans |
| `Plan` | Software architect for implementation strategies |
| `Explore` | Fast codebase exploration, file patterns, keyword search |

#### Testing & Debugging

| Agent | Use Case |
|-------|----------|
| `odin:test-writer` | Unit, integration, functional test suites |
| `odin:advanced-test-designer` | Stress testing, fuzz testing, chaos engineering |
| `odin:debugger` | Root cause analysis, error interpretation |
| `odin:investigator` | Deep debugging, issue tracing |
| `pr-review-toolkit:pr-test-analyzer` | Test coverage quality for PRs |
| `everything-claude-code:tdd-guide` | Test-driven development workflow |

#### Documentation & Refactoring

| Agent | Use Case |
|-------|----------|
| `odin:docs` / `odin:docs-architect` | Technical documentation, architecture guides |
| `odin:refactorer` | Code restructuring, design improvements |
| `odin:refactor-planner` | Detailed refactoring plans with migration paths |
| `odin:modernizer` | Legacy code updates to modern standards |
| `odin:tech-debt-resolver` | Technical debt assessment and remediation |

#### Performance & Optimization

| Agent | Use Case |
|-------|----------|
| `odin:performance` | Holistic performance optimization |
| `odin:memory-expert` | Memory usage patterns, leak detection |
| `odin:concurrency-expert` | Thread safety, race conditions, async patterns |

### Skills (Invoked via `Skill` tool)

Skills provide methodology guidance and structured workflows.

#### Development Methodologies

| Skill | Description |
|-------|-------------|
| `test-driven` | XP-style TDD: RED → GREEN → REFACTOR workflow |
| `validation-first` | Formal specifications with Quint |
| `design-by-contract` | Preconditions, postconditions, invariants |
| `proof-driven` | Formal verification with Lean 4 |
| `type-driven` | Idris 2 dependent types workflow |

#### Superpowers (Enhanced Workflows)

| Skill | Description |
|-------|-------------|
| `superpowers:brainstorming` | Creative exploration before implementation |
| `superpowers:writing-plans` | Structured implementation planning |
| `superpowers:systematic-debugging` | Methodical bug resolution |
| `superpowers:test-driven-development` | TDD workflow enforcement |
| `superpowers:verification-before-completion` | Evidence-based completion verification |
| `superpowers:requesting-code-review` | Pre-merge review workflow |
| `superpowers:dispatching-parallel-agents` | Independent task parallelization |

#### Design & Frontend

| Skill | Description |
|-------|-------------|
| `frontend-design:frontend-design` | Production-grade UI components |
| `figma:implement-design` | Figma to code with visual fidelity |
| `prompt-engineering` | LLM prompt optimization |

### MCP Tools Reference

Advanced tooling available through MCP servers.

#### Code Intelligence (Serena)

```
mcp__plugin_serena_serena__find_symbol        # Symbol search by name path
mcp__plugin_serena_serena__get_symbols_overview # File symbol overview
mcp__plugin_serena_serena__find_referencing_symbols # Reference finder
mcp__plugin_serena_serena__replace_symbol_body # Symbol replacement
mcp__plugin_serena_serena__search_for_pattern # Regex pattern search
```

#### AST-based Code Operations

```
mcp__plugin_odin_ast-grep__find_code          # AST pattern search
mcp__plugin_odin_ast-grep__find_code_by_rule  # YAML rule search
mcp__plugin_odin_ast-grep__dump_syntax_tree   # Syntax tree inspection
mcp__plugin_odin_code-index__search_code_advanced # Advanced code search
mcp__plugin_odin_code-index__get_symbol_body  # Symbol body retrieval
```

#### Research & Documentation

```
mcp__plugin_context7_context7__resolve-library-id  # Library ID lookup
mcp__plugin_context7_context7__query-docs          # Library docs query
mcp__plugin_perplexity_perplexity__perplexity_search # Web search
mcp__plugin_perplexity_perplexity__perplexity_research # Deep research
mcp__exa__web_search_exa                           # Exa web search
mcp__exa__get_code_context_exa                     # Code context search
```

#### Thinking & Analysis

```
mcp__plugin_odin_sequentialthinking-tools__sequentialthinking_tools # Problem decomposition
mcp__plugin_odin_actor-critic-thinking__actor-critic-thinking      # Dual-perspective analysis
mcp__plugin_odin_shannon-thinking__shannonthinking                  # Uncertainty modeling
mcp__plugin_odin_Check__vibe_check                                  # Assumption checking
```

#### PR & Review (Greptile)

```
mcp__plugin_greptile_greptile__list_pull_requests  # PR listing
mcp__plugin_greptile_greptile__get_merge_request   # PR details
mcp__plugin_greptile_greptile__trigger_code_review # Automated review
mcp__plugin_greptile_greptile__search_custom_context # Pattern search
```

#### Browser Automation (Playwright/Chrome)

```
mcp__plugin_playwright_playwright__browser_navigate # Page navigation
mcp__plugin_playwright_playwright__browser_snapshot # A11y tree capture
mcp__plugin_playwright_playwright__browser_click    # Element interaction
mcp__chrome_devtools__take_snapshot                 # DevTools snapshot
mcp__chrome_devtools__performance_start_trace       # Performance trace
```

### Slash Commands

Quick-access commands for common operations.

| Command | Description |
|---------|-------------|
| `/commit-commands:commit` | Git commit workflow |
| `/commit-commands:commit-push-pr` | Commit, push, and PR creation |
| `/pr-review-toolkit:review-pr [aspects]` | Comprehensive PR review |
| `/everything-claude-code:plan` | Implementation planning |
| `/everything-claude-code:tdd` | TDD workflow |
| `/code-review:code-review` | Code review PR |

### Usage Examples

#### Multi-Agent Parallel Execution

```markdown
# Launch multiple independent agents simultaneously
Task: Launch code-reviewer and security-auditor in parallel
→ Both agents run concurrently, return combined results
```

#### Skill-Guided Development

```markdown
# Invoke TDD skill before implementing feature
1. Skill: test-driven
2. Follow RED → GREEN → REFACTOR workflow
3. Skill: verification-before-completion
4. Commit with evidence of passing tests
```

#### Research-First Implementation

```markdown
# Query documentation before implementation
1. mcp__plugin_context7_context7__resolve-library-id (find library)
2. mcp__plugin_context7_context7__query-docs (get patterns)
3. Implement following documented patterns
```

---

## Critical Files Reference

- `MASTER_SPECIFICATION.md`: Complete technical specification (2,300+ lines)
- Database schema: See specification Section 9
- API endpoints: See specification Section 7
- Frontend components: See specification Section 8
- ML models: See specification Section 6
