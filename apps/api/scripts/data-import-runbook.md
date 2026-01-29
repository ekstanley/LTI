# Data Import Runbook

**Version**: 1.0.0
**Last Updated**: 2025-01-28
**Work Package**: WP7-A Historical Data Load

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Import Phases](#import-phases)
5. [CLI Reference](#cli-reference)
6. [Configuration](#configuration)
7. [Monitoring Progress](#monitoring-progress)
8. [Recovery & Resumption](#recovery--resumption)
9. [Validation](#validation)
10. [Troubleshooting](#troubleshooting)
11. [Performance Tuning](#performance-tuning)
12. [Maintenance](#maintenance)

---

## Overview

The LTIP Historical Data Load system imports legislative data from Congress.gov API into the PostgreSQL database. The import system is designed for:

- **Resumability**: Checkpoint-based tracking allows safe interruption and resumption
- **Rate Limiting**: Respects Congress.gov API limits (1000 requests/hour)
- **Validation**: Post-import data quality checks
- **Observability**: Progress tracking and comprehensive logging

### Data Volume Estimates

| Entity | Estimated Count | Notes |
|--------|----------------|-------|
| Legislators | ~550 | Current and recent members |
| Committees | ~280 | Including subcommittees |
| Bills (118th) | ~15,000 | 2023-2024 Congress |
| Bills (119th) | ~5,000 | 2025-2026 Congress |
| Roll Call Votes | ~1,800 | Both congresses |
| Individual Votes | ~900,000 | Vote positions |

### Estimated Duration

| Mode | Duration | Notes |
|------|----------|-------|
| Full Import | 4-8 hours | Depends on API response times |
| Dry Run | ~5 minutes | Limited to 100 records per phase |
| Single Phase | 30 min - 2 hours | Varies by data volume |

---

## Prerequisites

### Environment Variables

```bash
# Required
CONGRESS_API_KEY=your-api-key-here
DATABASE_URL=postgresql://user:pass@host:5432/database

# Optional
IMPORT_LOG_LEVEL=info  # debug, info, warn, error
```

### API Key

Obtain a Congress.gov API key from: https://api.congress.gov/sign-up

### Database

Ensure PostgreSQL is running and migrations are applied:

```bash
# From apps/api directory
pnpm prisma migrate deploy
```

### System Requirements

- Node.js 18+
- PostgreSQL 12+
- 2GB+ RAM available
- Stable network connection

---

## Quick Start

### Full Import (Recommended First Run)

```bash
# From repository root
pnpm --filter @ltip/api run import:run

# Or from apps/api directory
pnpm run import:run
```

### Dry Run (Test Mode)

```bash
pnpm --filter @ltip/api run import:dry-run
```

### Check Status

```bash
pnpm --filter @ltip/api run import:status
```

### Reset and Start Fresh

```bash
pnpm --filter @ltip/api run import:reset
```

---

## Import Phases

The import executes in a strict dependency order:

```
[1] legislators → [2] committees → [3] bills → [4] votes → [5] validate
```

### Phase 1: Legislators

**Duration**: ~5-10 minutes
**Records**: ~550
**Dependencies**: None

Imports all current and historical legislators from Congress.gov.

```bash
pnpm --filter @ltip/api run import:run --phase legislators
```

### Phase 2: Committees

**Duration**: ~5-10 minutes
**Records**: ~280
**Dependencies**: legislators

Imports committee structure including subcommittees.

```bash
pnpm --filter @ltip/api run import:run --phase committees
```

### Phase 3: Bills

**Duration**: 1-3 hours
**Records**: ~20,000
**Dependencies**: legislators, committees

Imports all bills for 118th and 119th Congresses.

```bash
pnpm --filter @ltip/api run import:run --phase bills
```

### Phase 4: Votes

**Duration**: 2-4 hours
**Records**: ~1,800 roll calls, ~900,000 positions
**Dependencies**: legislators, bills

Imports roll call votes and individual vote positions.

```bash
pnpm --filter @ltip/api run import:run --phase votes
```

### Phase 5: Validate

**Duration**: ~5 minutes
**Dependencies**: All phases complete

Runs validation checks on imported data.

```bash
pnpm --filter @ltip/api run import:run --phase validate
```

---

## CLI Reference

### Syntax

```bash
bulk-import [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--dry-run` | `-d` | Run without database changes |
| `--resume` | `-r` | Resume from checkpoint (default) |
| `--status` | `-s` | Show current import status |
| `--reset` | | Delete checkpoint and start fresh |
| `--force` | `-f` | Force re-import (ignore existing) |
| `--verbose` | `-v` | Enable verbose logging |
| `--phase <name>` | `-p` | Run specific phase only |

### Examples

```bash
# Full import with verbose logging
bulk-import --verbose

# Test run specific phase
bulk-import --dry-run --phase bills

# Check status without running
bulk-import --status

# Force complete re-import
bulk-import --force

# Resume after interruption (default behavior)
bulk-import
```

---

## Configuration

Configuration is defined in `scripts/import-config.ts`.

### Rate Limits

```typescript
{
  maxRequestsPerHour: 900,   // Official limit: 1000
  burstCapacity: 100,
  minDelayMs: 100,
  cooldownDelayMs: 5000
}
```

### Batch Sizes

```typescript
{
  legislators: 100,    // API fetch batch
  committees: 50,
  bills: 100,
  votes: 50,
  votePositions: 500
}
```

### Timeouts

```typescript
{
  requestTimeoutMs: 30000,      // Single API request
  dbTransactionTimeoutMs: 60000,
  phaseTimeoutMs: 14400000,     // 4 hours per phase
  rateLimitTimeoutMs: 60000
}
```

### Target Congresses

By default, imports data for:
- 118th Congress (2023-2024)
- 119th Congress (2025-2026)

---

## Monitoring Progress

### Status Display

```bash
pnpm --filter @ltip/api run import:status
```

Output example:

```
=== Import Status ===

Run ID:        import-20250128-143052
Current Phase: bills
Progress:      35%
Elapsed:       1h 15m
Phases:        2/5 complete

Phase Status:
  ✓ legislators  COMPLETE
  ✓ committees   COMPLETE
  → bills        IN PROGRESS
    votes        PENDING
    validate     PENDING

Current Phase Details:
  Records: 7000/20000
  Congress: 118
  Bill Type: HR
  Offset: 7000
```

### Log Files

Logs are written to `apps/api/logs/import.log`.

Log levels (set via `IMPORT_LOG_LEVEL`):
- `debug`: All messages including API calls
- `info`: Progress updates and summaries (default)
- `warn`: Warnings and recoverable errors
- `error`: Critical errors only

### Console Output

Progress bars show real-time status:

```
[████████████░░░░░░░░] 60% (12000/20000) [C118/hr]
```

---

## Recovery & Resumption

### Automatic Checkpointing

The system automatically saves progress to:
```
apps/api/.import-checkpoints/import-checkpoint.json
```

Checkpoints are saved:
- Every 100 records processed
- Every 30 seconds
- On graceful shutdown (SIGINT/SIGTERM)
- After each batch completion

### Resuming After Interruption

Simply run the import again:

```bash
pnpm --filter @ltip/api run import:run
```

The system will:
1. Load the existing checkpoint
2. Display current progress
3. Resume from the last successful position

### Checkpoint Contents

```json
{
  "runId": "import-20250128-143052",
  "phase": "bills",
  "completedPhases": ["legislators", "committees"],
  "startedAt": "2025-01-28T14:30:52.000Z",
  "lastUpdatedAt": "2025-01-28T15:45:00.000Z",
  "offset": 7000,
  "congress": 118,
  "billType": "hr",
  "recordsProcessed": 7000,
  "totalExpected": 20000
}
```

### Manual Recovery

If checkpoint is corrupted:

```bash
# Reset checkpoint and start fresh
pnpm --filter @ltip/api run import:reset

# Then run import
pnpm --filter @ltip/api run import:run
```

---

## Validation

### Automatic Validation

The validate phase runs automatically as the final step. It checks:

1. **Record Counts**: Minimum thresholds met
2. **Referential Integrity**: Foreign keys resolve
3. **Data Quality**: Required fields populated
4. **Distribution**: Chamber/party balance

### Manual Validation

```bash
pnpm --filter @ltip/api run import:run --phase validate
```

### Validation Thresholds

| Check | Threshold |
|-------|-----------|
| Legislators | >= 535 |
| Committees | >= 200 |
| Bills (118th) | >= 12,000 |
| Bills (119th) | >= 3,000 |
| Sync timestamps | < 24 hours old |

### Validation Output

```
=== Data Import Validation ===

Record Count Validation:
  ✓ Legislators: 547 (min: 535)
  ✓ Committees: 273 (min: 200)
  ✓ Bills 118: 14,892 (min: 12,000)
  ✓ Bills 119: 4,127 (min: 3,000)

Referential Integrity:
  ✓ Bill sponsors resolved
  ✓ Committee hierarchy intact
  ✓ Vote legislators linked
  ✓ Vote roll calls linked

Data Quality:
  ✓ Bills have titles: 100%
  ✓ Legislators have names: 100%
  ✓ Valid dates: 100%

VALIDATION PASSED (12/12 checks)
```

---

## Troubleshooting

### Common Issues

#### Rate Limit Exceeded

**Symptom**: HTTP 429 errors, slow progress

**Solution**:
1. Wait 5-10 minutes for rate limit reset
2. Resume import (it will automatically back off)

```bash
# Simply resume
pnpm --filter @ltip/api run import:run
```

#### Database Connection Lost

**Symptom**: Prisma connection errors

**Solution**:
1. Check PostgreSQL is running
2. Verify DATABASE_URL
3. Resume import

```bash
# Check database
docker ps | grep postgres

# Resume
pnpm --filter @ltip/api run import:run
```

#### API Key Invalid

**Symptom**: HTTP 401/403 errors immediately

**Solution**:
1. Verify CONGRESS_API_KEY is set
2. Check key validity at api.congress.gov

```bash
# Test API key
curl -H "X-API-Key: $CONGRESS_API_KEY" \
  "https://api.congress.gov/v3/bill?limit=1"
```

#### Out of Memory

**Symptom**: Process crashes, Node heap errors

**Solution**:
1. Check available memory
2. Reduce batch sizes in config
3. Restart import

```bash
# Monitor memory during import
top -l 1 | grep node

# Consider increasing Node memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm run import:run
```

#### Checkpoint Corrupted

**Symptom**: JSON parse errors on startup

**Solution**:
```bash
# Reset checkpoint
pnpm --filter @ltip/api run import:reset

# Start fresh
pnpm --filter @ltip/api run import:run
```

### Diagnostic Commands

```bash
# View checkpoint file
cat apps/api/.import-checkpoints/import-checkpoint.json | jq .

# Check database counts
docker exec postgres psql -U postgres ltip -c "
  SELECT 'legislators' as entity, COUNT(*) FROM legislators
  UNION ALL
  SELECT 'committees', COUNT(*) FROM committees
  UNION ALL
  SELECT 'bills', COUNT(*) FROM bills
  UNION ALL
  SELECT 'votes', COUNT(*) FROM votes;
"

# View recent logs
tail -100 apps/api/logs/import.log
```

---

## Performance Tuning

### Optimize for Speed

Increase batch sizes (if system has capacity):

```typescript
// In import-config.ts
BATCH_SIZES.bills = 200;      // Default: 100
BATCH_SIZES.votes = 100;      // Default: 50
DB_BATCH_SIZES.bills = 100;   // Default: 50
```

### Optimize for Memory

Decrease batch sizes:

```typescript
BATCH_SIZES.bills = 50;       // Default: 100
BATCH_SIZES.votePositions = 250;  // Default: 500
```

### Parallel Processing

The import phases are sequential by design due to foreign key dependencies. Within each phase, database batching is optimized for throughput while respecting API rate limits.

### Network Optimization

- Use a stable wired connection
- Minimize network latency to Congress.gov (US-based servers)
- Consider running from a US-region cloud instance

---

## Maintenance

### Post-Import Tasks

1. **Verify data quality**: Run validation phase
2. **Create database indexes**: Ensure query performance
3. **Update application caches**: Clear any stale caches
4. **Monitor query performance**: Check slow query logs

### Incremental Updates

For ongoing data updates (after initial load):

```bash
# Re-import specific congress
pnpm run import:run --phase bills --congress 119
```

Note: The system uses upsert operations, so re-running is safe and will update existing records.

### Cleanup

Remove checkpoint files after successful import:

```bash
rm -rf apps/api/.import-checkpoints/
```

### Backup Recommendations

Before large imports:
```bash
# Backup database
pg_dump -U postgres ltip > backup_pre_import.sql
```

---

## Architecture Reference

### File Structure

```
apps/api/scripts/
├── bulk-import.ts         # CLI orchestrator
├── import-config.ts       # Configuration constants
├── checkpoint-manager.ts  # Progress tracking
├── import-legislators.ts  # Legislator import
├── import-committees.ts   # Committee import
├── import-bills.ts        # Bill import
├── import-votes.ts        # Vote import
├── validate-import.ts     # Data validation
└── data-import-runbook.md # This document
```

### Data Flow

```
Congress.gov API
       │
       ▼
  Rate Limiter (1000 req/hr)
       │
       ▼
  Async Generator (streaming batches)
       │
       ▼
  Transform (API → Prisma format)
       │
       ▼
  Upsert Batch (PostgreSQL)
       │
       ▼
  Update Checkpoint
```

### Phase Dependencies

```
legislators ─┬─► committees ─┬─► bills ─┬─► votes ─┬─► validate
             │               │          │          │
             └───────────────┴──────────┴──────────┘
                    (all phases required for validate)
```

---

## Support

### Logs Location

- Import logs: `apps/api/logs/import.log`
- Checkpoint: `apps/api/.import-checkpoints/`

### Useful Commands

```bash
# Show status
pnpm --filter @ltip/api run import:status

# Verbose mode
pnpm --filter @ltip/api run import:run --verbose

# Test without writing
pnpm --filter @ltip/api run import:dry-run
```

### API Documentation

- Congress.gov API: https://api.congress.gov/
- Prisma Client: https://www.prisma.io/docs/

---

**Document Revision History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-28 | Initial release for WP7-A |
