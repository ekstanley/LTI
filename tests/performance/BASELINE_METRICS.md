# LTI API Performance Baseline Metrics

**Version**: 1.0.0
**Last Updated**: 2026-02-01
**Test Environment**: Local development (MacOS, localhost:4000)
**k6 Version**: v1.4.2
**Load Profile**: Medium (20-50 VUs, 2 minutes)

---

## Executive Summary

Performance baselines for all LTI API endpoints under medium load conditions. These metrics serve as reference points for:
- Performance regression detection
- Capacity planning
- Optimization prioritization
- SLA establishment

**Status**: ⚠️ **PENDING** - Baselines need to be established once API server is operational

**Current Blocker**: API server import error needs resolution:
```
SyntaxError: The requested module '@ltip/shared/validation' does not provide an export named 'validateBillId'
```

---

## How to Establish Baselines

Once the API server is operational:

```bash
# 1. Start API server
pnpm --filter=@ltip/api dev

# 2. Verify server is running
curl http://localhost:4000/api/health

# 3. Run each test script with medium profile
cd tests/performance

k6 run bills.js > bills-baseline.txt
k6 run legislators.js > legislators-baseline.txt
k6 run votes.js > votes-baseline.txt
k6 run conflicts.js > conflicts-baseline.txt
k6 run auth.js > auth-baseline.txt
k6 run analysis.js > analysis-baseline.txt

# 4. Extract metrics and update this file
```

---

## Bills API Baselines

### GET /api/bills (List Bills)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 600ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Throughput | > 50 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id (Single Bill)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 150ms | TBD | ⏳ Pending |
| P95 latency | < 300ms | TBD | ⏳ Pending |
| P99 latency | < 600ms | TBD | ⏳ Pending |
| Throughput | > 100 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id/sponsors

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 400ms | TBD | ⏳ Pending |
| P99 latency | < 800ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id/cosponsors

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 400ms | TBD | ⏳ Pending |
| P99 latency | < 800ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id/actions

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 250ms | TBD | ⏳ Pending |
| P95 latency | < 500ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id/text

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 250ms | TBD | ⏳ Pending |
| P95 latency | < 500ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/bills/:id/related

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 300ms | TBD | ⏳ Pending |
| P95 latency | < 600ms | TBD | ⏳ Pending |
| P99 latency | < 1200ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

---

## Legislators API Baselines

### GET /api/legislators (List Legislators)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 600ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Throughput | > 50 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/legislators/:id (Single Legislator)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 150ms | TBD | ⏳ Pending |
| P95 latency | < 300ms | TBD | ⏳ Pending |
| P99 latency | < 600ms | TBD | ⏳ Pending |
| Throughput | > 100 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/legislators/:id/committees

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 400ms | TBD | ⏳ Pending |
| P99 latency | < 800ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

---

## Votes API Baselines

### GET /api/votes (List Votes)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 250ms | TBD | ⏳ Pending |
| P95 latency | < 700ms | TBD | ⏳ Pending |
| P99 latency | < 1200ms | TBD | ⏳ Pending |
| Throughput | > 40 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/votes/:id (Single Vote)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 150ms | TBD | ⏳ Pending |
| P95 latency | < 300ms | TBD | ⏳ Pending |
| P99 latency | < 600ms | TBD | ⏳ Pending |
| Throughput | > 100 req/s | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

### GET /api/votes/:id/breakdown

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 300ms | TBD | ⏳ Pending |
| P95 latency | < 600ms | TBD | ⏳ Pending |
| P99 latency | < 1200ms | TBD | ⏳ Pending |
| Error rate | < 1% | TBD | ⏳ Pending |

---

## Conflicts API Baselines

**Note**: Conflicts API currently returns empty data (feature not implemented).
Baselines will be established when feature is complete.

### GET /api/conflicts (List Conflicts)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 150ms | TBD | ⏳ Pending |
| P95 latency | < 500ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Error rate | 0% (200 OK) | TBD | ⏳ Pending |

### GET /api/conflicts/:id (Single Conflict)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 100ms | TBD | ⏳ Pending |
| P95 latency | < 300ms | TBD | ⏳ Pending |
| P99 latency | < 600ms | TBD | ⏳ Pending |
| Error rate | 100% (404) | TBD | ⏳ Pending |

---

## Auth API Baselines

**Note**: Auth endpoints include argon2 password hashing, which is intentionally slow.
Higher latency thresholds are expected.

### POST /api/v1/auth/register

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 800ms | TBD | ⏳ Pending |
| P95 latency | < 1500ms | TBD | ⏳ Pending |
| P99 latency | < 3000ms | TBD | ⏳ Pending |
| Error rate | < 5% | TBD | ⏳ Pending |

### POST /api/v1/auth/login

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 600ms | TBD | ⏳ Pending |
| P95 latency | < 1000ms | TBD | ⏳ Pending |
| P99 latency | < 2000ms | TBD | ⏳ Pending |
| Error rate | < 5% | TBD | ⏳ Pending |

### POST /api/v1/auth/refresh

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 400ms | TBD | ⏳ Pending |
| P95 latency | < 800ms | TBD | ⏳ Pending |
| P99 latency | < 1500ms | TBD | ⏳ Pending |
| Error rate | < 5% | TBD | ⏳ Pending |

### POST /api/v1/auth/logout

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 500ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Error rate | < 5% | TBD | ⏳ Pending |

### GET /api/v1/auth/profile

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 200ms | TBD | ⏳ Pending |
| P95 latency | < 500ms | TBD | ⏳ Pending |
| P99 latency | < 1000ms | TBD | ⏳ Pending |
| Error rate | < 5% | TBD | ⏳ Pending |

---

## Analysis API Baselines

**Note**: Analysis API currently returns 404/placeholder responses (feature not implemented).
Baselines will be established when feature is complete.

### GET /api/analysis/:billId

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 1000ms | TBD | ⏳ Pending |
| P95 latency | < 2000ms | TBD | ⏳ Pending |
| P99 latency | < 5000ms | TBD | ⏳ Pending |
| Error rate | 100% (404) | TBD | ⏳ Pending |

### POST /api/analysis/:billId/generate

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P50 latency | < 1500ms | TBD | ⏳ Pending |
| P95 latency | < 3000ms | TBD | ⏳ Pending |
| P99 latency | < 10000ms | TBD | ⏳ Pending |
| Error rate | 0% (202) | TBD | ⏳ Pending |

---

## Overall System Performance

### Summary Metrics (All Endpoints)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Overall P95 latency | < 800ms | TBD | ⏳ Pending |
| Overall P99 latency | < 1500ms | TBD | ⏳ Pending |
| Average throughput | > 50 req/s | TBD | ⏳ Pending |
| Overall error rate | < 2% | TBD | ⏳ Pending |

### Resource Utilization (During Tests)

| Resource | Target | Actual | Status |
|----------|--------|--------|--------|
| API Server CPU | < 70% | TBD | ⏳ Pending |
| API Server Memory | < 512MB | TBD | ⏳ Pending |
| Database CPU | < 60% | TBD | ⏳ Pending |
| Database Connections | < 80% of pool | TBD | ⏳ Pending |

---

## Performance Trends

### Historical Data

*To be populated with subsequent test runs*

| Date | Profile | Overall P95 | Throughput | Error Rate | Notes |
|------|---------|-------------|------------|------------|-------|
| 2026-02-01 | Medium | TBD | TBD | TBD | Initial baseline (pending) |

---

## Recommendations

Once baselines are established, the following actions should be considered:

### Immediate Actions (If P95 > 1000ms)
1. ❌ **Database indexing**: Review slow queries
2. ❌ **Connection pooling**: Optimize database connection settings
3. ❌ **Caching**: Implement Redis caching for frequently accessed data
4. ❌ **Query optimization**: Review N+1 query patterns

### Medium-term Actions (If P95 > 800ms)
1. ❌ **Code profiling**: Identify hot paths
2. ❌ **Database query optimization**: Review and optimize slow queries
3. ❌ **API response compression**: Enable gzip/brotli
4. ❌ **CDN integration**: Offload static assets

### Long-term Actions (Capacity Planning)
1. ❌ **Horizontal scaling**: Add more API instances
2. ❌ **Database read replicas**: Distribute read load
3. ❌ **Caching layer**: Implement comprehensive caching strategy
4. ❌ **Load balancing**: Distribute traffic across instances

---

## Notes

- **Environment**: Local development (not production)
- **Database**: PostgreSQL (version TBD)
- **API Framework**: Express.js
- **Node.js Version**: v25.2.1
- **Hardware**: MacOS (details TBD)

---

## Next Steps

1. ✅ k6 scripts created and documented
2. ⏳ **Fix API server import error** (blocking)
3. ⏳ **Run baseline tests** (once API operational)
4. ⏳ **Update this document with actual metrics**
5. ⏳ **Establish performance regression testing in CI/CD**
6. ⏳ **Set up continuous monitoring**

---

**Maintained by**: Agent 3 (Performance Testing)
**Contact**: See project documentation for team contacts
