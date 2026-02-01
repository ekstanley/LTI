# WP11 Performance Validation Plan - Executive Summary

**Date**: 2026-01-31
**Status**: Ready for Implementation
**Estimated Effort**: 40 hours (1-2 weeks)
**Total Cost**: $0-110/month

---

## Quick Overview

This plan establishes comprehensive performance validation for LTIP covering:
- Load testing infrastructure
- Performance benchmarks for all 6 pages
- Automated regression testing
- Production monitoring and alerting
- Bottleneck identification and profiling

---

## Tool Stack

### Load Testing
- **k6** (Primary) - Modern, JavaScript-based, excellent API testing
- **Artillery** (Secondary) - WebSocket and complex user journeys
- **Cost**: Free (OSS), optional k6 Cloud at $49/mo

### Frontend Testing
- **Lighthouse CI** - Automated Core Web Vitals testing
- **Next.js Bundle Analyzer** - Bundle size analysis
- **Cost**: Free

### Backend Profiling
- **clinic.js** - CPU/memory profiling for Node.js
- **prom-client** - Prometheus metrics
- **Cost**: Free

### Monitoring Stack
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and alerting
- **web-vitals** - Real User Monitoring (RUM)
- **Cost**: Free (self-hosted), ~$60/mo if hosted

---

## Performance Budgets (Core Web Vitals)

| Metric | Industry Standard | LTIP Target | Status |
|--------|------------------|-------------|--------|
| LCP | ≤2.5s | **≤2.0s** | Aggressive |
| FID | ≤100ms | **≤75ms** | Aggressive |
| CLS | ≤0.1 | **≤0.08** | Aggressive |
| FCP | ≤1.8s | **≤1.5s** | Aggressive |
| TTFB | ≤800ms | **≤600ms** | Aggressive |
| INP | ≤200ms | **≤150ms** | Aggressive |

---

## Page-Specific Targets (p95)

| Page | LCP | API Response | Bundle Size | Priority |
|------|-----|--------------|-------------|----------|
| / (Homepage) | 1.8s | N/A | 200KB | Medium |
| /bills | 2.3s | 500ms | 250KB | High |
| /legislators | 2.3s | 500ms | 250KB | High |
| /votes | 2.5s | 700ms | 300KB | Critical |
| /bills/[id] | 2.0s | 400ms | 220KB | Medium |
| /legislators/[id] | 2.0s | 400ms | 220KB | Medium |

**Note**: /votes is most data-heavy and critical for optimization

---

## Test Scenarios

### 1. Smoke Test (Every commit)
- **Load**: 1-5 VUs
- **Duration**: 1 minute
- **Purpose**: Basic functionality check

### 2. Load Test (Weekly)
- **Load**: 0→50→0 VUs
- **Duration**: 10 minutes
- **Purpose**: Normal production simulation

### 3. Stress Test (Monthly)
- **Load**: 0→100→200→0 VUs
- **Duration**: 15 minutes
- **Purpose**: Find breaking point

### 4. Spike Test (Pre-release)
- **Load**: 10→200 (instant)→10 VUs
- **Duration**: 5 minutes
- **Purpose**: Traffic surge handling

### 5. Soak Test (Pre-deployment)
- **Load**: 30 VUs constant
- **Duration**: 4 hours
- **Purpose**: Memory leak detection

---

## Identified Bottlenecks (Priority Order)

### Critical (Week 1)
1. **Database Queries**
   - N+1 queries in list endpoints
   - Missing indexes on foreign keys
   - No pagination limits
   - **Impact**: High (likely 70% of API latency)

2. **API Serialization**
   - Large JSON payloads
   - Inefficient serialization
   - **Impact**: Medium (20% of API latency)

3. **Frontend Bundle**
   - Large JavaScript bundles
   - No code splitting
   - **Impact**: High (blocks initial render)

### Secondary (Week 2)
4. **Authentication**
   - JWT verification overhead
   - No caching
   - **Impact**: Low-Medium (every request)

5. **WebSocket**
   - Connection pooling
   - Message throughput
   - **Impact**: Medium (real-time features)

6. **Static Assets**
   - Unoptimized images
   - Missing caching
   - **Impact**: Medium (LCP)

---

## Regression Testing Strategy

### Phase 1: Baseline (Week 1-2)
- Collect performance data
- Establish budgets
- **Mode**: Monitor only (no blocking)

### Phase 2: Warning (Week 3-4)
- Enable PR warnings
- Track violations
- **Mode**: Warn on violations

### Phase 3: Enforcement (Week 5+)
- Block failing PRs
- Require justification
- **Mode**: Full enforcement

### CI/CD Integration
```yaml
Every PR:
  - Lighthouse CI (Core Web Vitals)
  - Results in PR comment

Every merge to main:
  - k6 smoke test
  - Performance report

Weekly (scheduled):
  - Full load test suite
  - Bottleneck profiling
```

---

## Monitoring Architecture

### Real User Monitoring (RUM)
```
Browser (web-vitals) → POST /api/analytics/vitals → Pino logs → Prometheus
```

**Metrics Collected**:
- LCP, FID, CLS, FCP, TTFB, INP
- Page route
- User agent
- Timestamp

### Backend Monitoring
```
API Requests → Metrics Middleware → Prometheus → Grafana
```

**Metrics Collected**:
- Request rate (req/s)
- Response time percentiles (p50, p95, p99)
- Error rate
- Database query duration
- Active connections

### Alerts

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High API Latency | p95 > 2.5s for 5m | Warning | Investigate |
| Critical API Latency | p95 > 5.0s for 2m | Critical | Page on-call |
| High Error Rate | >1% for 5m | Warning | Check logs |
| Critical Error Rate | >5% for 2m | Critical | Immediate response |
| Slow DB Queries | p95 > 1.0s for 5m | Warning | Optimize queries |

---

## Implementation Roadmap

### Week 1: Foundation (8 hours)
- [ ] Install k6, Lighthouse CI
- [ ] Set up Prometheus + Grafana
- [ ] Create baseline smoke test
- [ ] Run initial benchmarks

**Deliverable**: Working monitoring stack, baseline data

### Week 2: Test Suite (16 hours)
- [ ] Create all 5 k6 scenarios
- [ ] Create Artillery WebSocket test
- [ ] Document baseline performance
- [ ] Set performance budgets
- [ ] Integrate with GitHub Actions

**Deliverable**: Complete test suite, CI/CD integration

### Week 3: Production Monitoring (16 hours)
- [ ] Implement Web Vitals RUM
- [ ] Add Prometheus metrics to API
- [ ] Configure alerts
- [ ] Create Grafana dashboards
- [ ] Execute comprehensive testing
- [ ] Profile bottlenecks
- [ ] Document findings

**Deliverable**: Production monitoring active, bottleneck report

---

## Success Criteria

### Must Have
- [x] Comprehensive plan documented
- [ ] All 5 test scenarios implemented
- [ ] Lighthouse CI in GitHub Actions
- [ ] Performance budgets established
- [ ] Production monitoring deployed
- [ ] 3+ bottlenecks identified

### Should Have
- [ ] Web Vitals RUM collecting data
- [ ] Alert rules tested
- [ ] Team trained on tools
- [ ] Performance improvement backlog

### Nice to Have
- [ ] k6 Cloud integration
- [ ] Grafana Cloud dashboards
- [ ] Automated PR comments
- [ ] Performance badges

---

## Key Performance Targets

### API (p95 under normal load)
- Health check: <30ms
- List endpoints: <500ms
- Detail endpoints: <400ms
- Analysis endpoints: <1200ms

### Frontend (75th percentile)
- All Core Web Vitals: "Good" rating
- Bundle size: <300KB per page
- Lighthouse score: ≥90

### System
- Error rate: <1%
- No memory leaks (4h soak test)
- Handles 2x traffic spike
- Recovery time: <2 minutes

---

## Cost Breakdown

### Tooling
| Item | Cost | Notes |
|------|------|-------|
| k6 OSS | Free | Primary load testing |
| Lighthouse CI | Free | Core Web Vitals testing |
| Prometheus | Free | Self-hosted metrics |
| Grafana | Free | Self-hosted dashboards |
| k6 Cloud (optional) | $49/mo | Cloud test execution |

### Infrastructure
| Item | Cost | Notes |
|------|------|-------|
| Monitoring server | $40/mo | 2GB RAM, 2 vCPU |
| Development/staging | $20/mo | Optional separate instance |

**Total**: $0-110/month

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Flaky tests | Multiple runs, statistical analysis |
| CI slowdown | Smoke tests on PR, full tests on main |
| Team resistance | Progressive rollout, training |
| Monitoring overhead | Sample metrics (10% initially) |
| Production variance | Use production-like data volume |

---

## Next Actions

1. **Review** (Day 1)
   - Team review of plan
   - Approve tool selection
   - Allocate 40 hours

2. **Setup** (Days 2-3)
   - Install tools
   - Configure environments
   - Create test accounts/data

3. **Baseline** (Days 4-5)
   - Run initial tests
   - Document current state
   - Set budgets

4. **Build** (Days 6-10)
   - Implement test suite
   - Integrate CI/CD
   - Deploy monitoring

5. **Validate** (Days 11-14)
   - Execute full tests
   - Profile bottlenecks
   - Document findings

6. **Deliver** (Day 15)
   - Final report
   - Team presentation
   - Handoff to ops

---

## Documentation

**Full Plan**: `/Users/estanley/Documents/GitHub/LTI/docs/plans/WP11-performance-validation-plan.md`

**Contains**:
- Detailed tool configuration
- Complete test scenarios
- Step-by-step implementation guide
- Code examples and templates
- Monitoring stack setup
- Alert configurations
- Grafana dashboard specs
- Budget templates
- Maintenance procedures

---

## Questions?

- **How long will this take?** 40 hours total (1-2 weeks)
- **What's the cost?** $0-110/month
- **Will it slow down CI?** No, smoke tests <2 minutes
- **When do we enforce budgets?** After 4 weeks of baselining
- **What if we fail budgets?** Progressive: warn → soft block → hard block
- **Who maintains this?** 4 hours/week ongoing maintenance

---

**Status**: READY FOR EXECUTION
**Full Documentation**: docs/plans/WP11-performance-validation-plan.md
**Owner**: TBD
**Timeline**: 2 weeks
