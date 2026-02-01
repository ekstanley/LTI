# WP11: Performance Validation Plan

**Version**: 1.0.0
**Created**: 2026-01-31
**Status**: READY FOR EXECUTION
**Estimated Effort**: 40 hours (1 week full-time, 2 weeks part-time)

---

## Executive Summary

This document outlines the comprehensive performance validation strategy for the Legislative Tracking Intelligence Platform (LTIP). The plan establishes load testing infrastructure, performance benchmarks, regression testing automation, and production monitoring to ensure the system meets production readiness standards.

### Objectives
- Establish performance baselines for all routes
- Implement automated regression testing
- Deploy production monitoring and alerting
- Identify and document performance bottlenecks
- Ensure Core Web Vitals compliance

---

## 1. Load Testing Strategy

### 1.1 Tool Selection

#### Primary: k6 (Grafana k6)
**Rationale**: TypeScript/JavaScript team compatibility, cloud-ready, excellent API testing, Prometheus integration

**Installation**:
```bash
# macOS
brew install k6

# npm (for scripting)
npm install --save-dev k6
```

**Key Features**:
- JavaScript/TypeScript test scripts
- Virtual Users (VUs) for concurrent load simulation
- Built-in HTTP/1.1, HTTP/2, WebSocket support
- Prometheus metrics export
- Cloud execution option (k6 Cloud)
- Thresholds for pass/fail criteria

#### Secondary: Artillery
**Rationale**: Complex user journey testing, WebSocket scenarios

**Installation**:
```bash
npm install --save-dev artillery artillery-plugin-metrics-by-endpoint
```

**Use Cases**:
- WebSocket connection testing
- Multi-step user flows
- Complex scenario orchestration

### 1.2 Test Scenarios

#### Smoke Test
**Purpose**: Verify system handles minimal load
**Duration**: 1 minute
**Load**: 1-5 VUs
**Frequency**: Every commit to main

```javascript
// k6/smoke-test.js
export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p95<2000'], // 95% under 2s
    http_req_failed: ['rate<0.01'],  // <1% errors
  },
};
```

#### Load Test
**Purpose**: Test normal production load
**Duration**: 10 minutes
**Load**: Ramp 0→50→0 VUs
**Frequency**: Weekly, before releases

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up
    { duration: '5m', target: 50 },  // Sustained load
    { duration: '2m', target: 10 },  // Ramp down
    { duration: '1m', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p95<2500', 'p99<5000'],
    http_req_failed: ['rate<0.01'],
  },
};
```

#### Stress Test
**Purpose**: Find breaking point
**Duration**: 15 minutes
**Load**: Ramp 0→100→200→0 VUs
**Frequency**: Monthly

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Normal load
    { duration: '5m', target: 100 },  // High load
    { duration: '3m', target: 200 },  // Breaking point
    { duration: '2m', target: 100 },  // Recovery
    { duration: '3m', target: 0 },    // Cool down
  ],
};
```

#### Spike Test
**Purpose**: Test sudden traffic surge
**Duration**: 5 minutes
**Load**: 10 VUs → 200 VUs (instant) → 10 VUs
**Frequency**: Before major releases

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Baseline
    { duration: '0s', target: 200 },  // Spike!
    { duration: '3m', target: 200 },  // Sustained spike
    { duration: '1m', target: 10 },   // Recovery
  ],
};
```

#### Soak Test
**Purpose**: Test memory leaks and long-running stability
**Duration**: 4 hours
**Load**: Constant 30 VUs
**Frequency**: Before production deployment

```javascript
export const options = {
  vus: 30,
  duration: '4h',
  thresholds: {
    http_req_duration: ['p95<2500'],
    http_req_failed: ['rate<0.01'],
  },
};
```

---

## 2. Performance Benchmarks

### 2.1 Core Web Vitals Budgets

Based on industry standards and Google recommendations:

| Metric | Good | Needs Improvement | Poor | LTIP Target |
|--------|------|-------------------|------|-------------|
| LCP    | ≤2.5s | 2.5s-4.0s | >4.0s | **≤2.0s** |
| FID    | ≤100ms | 100ms-300ms | >300ms | **≤75ms** |
| CLS    | ≤0.1 | 0.1-0.25 | >0.25 | **≤0.08** |
| FCP    | ≤1.8s | 1.8s-3.0s | >3.0s | **≤1.5s** |
| TTFB   | ≤800ms | 800ms-1800ms | >1800ms | **≤600ms** |
| INP    | ≤200ms | 200ms-500ms | >500ms | **≤150ms** |

### 2.2 Page-Specific Benchmarks

#### Homepage (/)
**Type**: Static marketing page
**Expected Data**: Minimal, mostly static content

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 1.2s | 1.8s | 2.0s |
| FCP | 0.8s | 1.2s | 1.5s |
| TTI | 2.0s | 3.0s | 3.5s |
| Bundle Size | ≤150KB | ≤200KB | ≤250KB |

#### Bills List (/bills)
**Type**: Data-heavy list page
**Expected Data**: 50-100 bills per page

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 1.8s | 2.3s | 2.5s |
| FCP | 1.0s | 1.5s | 1.8s |
| TTI | 2.5s | 3.5s | 4.0s |
| API Response | 200ms | 500ms | 800ms |
| Bundle Size | ≤200KB | ≤250KB | ≤300KB |

#### Legislators List (/legislators)
**Type**: Data-heavy list page
**Expected Data**: 50-100 legislators per page

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 1.8s | 2.3s | 2.5s |
| FCP | 1.0s | 1.5s | 1.8s |
| TTI | 2.5s | 3.5s | 4.0s |
| API Response | 200ms | 500ms | 800ms |
| Bundle Size | ≤200KB | ≤250KB | ≤300KB |

#### Votes List (/votes)
**Type**: Very data-heavy list page (highest volume)
**Expected Data**: 100+ votes per page

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 2.0s | 2.5s | 3.0s |
| FCP | 1.2s | 1.8s | 2.0s |
| TTI | 3.0s | 4.0s | 4.5s |
| API Response | 300ms | 700ms | 1000ms |
| Bundle Size | ≤250KB | ≤300KB | ≤350KB |

#### Bill Detail (/bills/[id])
**Type**: Detail page, lighter load
**Expected Data**: Single bill with relationships

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 1.5s | 2.0s | 2.3s |
| FCP | 0.9s | 1.3s | 1.6s |
| TTI | 2.2s | 3.0s | 3.5s |
| API Response | 150ms | 400ms | 600ms |
| Bundle Size | ≤180KB | ≤220KB | ≤260KB |

#### Legislator Detail (/legislators/[id])
**Type**: Detail page, lighter load
**Expected Data**: Single legislator with relationships

| Metric | Target (p50) | Target (p95) | Target (p99) |
|--------|--------------|--------------|--------------|
| LCP | 1.5s | 2.0s | 2.3s |
| FCP | 0.9s | 1.3s | 1.6s |
| TTI | 2.2s | 3.0s | 3.5s |
| API Response | 150ms | 400ms | 600ms |
| Bundle Size | ≤180KB | ≤220KB | ≤260KB |

### 2.3 API Endpoint Benchmarks

| Endpoint | Method | p50 | p95 | p99 | Max |
|----------|--------|-----|-----|-----|-----|
| GET /api/health | GET | 10ms | 20ms | 30ms | 50ms |
| GET /api/bills | GET | 150ms | 400ms | 700ms | 1000ms |
| GET /api/bills/:id | GET | 100ms | 300ms | 500ms | 800ms |
| GET /api/legislators | GET | 150ms | 400ms | 700ms | 1000ms |
| GET /api/legislators/:id | GET | 100ms | 300ms | 500ms | 800ms |
| GET /api/votes | GET | 200ms | 500ms | 900ms | 1200ms |
| GET /api/votes/:id | GET | 100ms | 300ms | 500ms | 800ms |
| POST /api/auth/login | POST | 200ms | 500ms | 800ms | 1000ms |
| POST /api/auth/register | POST | 300ms | 700ms | 1000ms | 1500ms |
| GET /api/analysis/* | GET | 500ms | 1200ms | 2000ms | 3000ms |

---

## 3. Regression Testing Strategy

### 3.1 Automated CI/CD Integration

#### GitHub Actions Workflow

Create `.github/workflows/performance.yml`:

```yaml
name: Performance Testing

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]
  schedule:
    - cron: '0 2 * * 1' # Weekly Monday 2 AM

jobs:
  lighthouse-ci:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        working-directory: apps/web

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli@0.13.x
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

  k6-smoke-test:
    name: k6 Smoke Test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Run smoke test
        run: k6 run tests/performance/smoke-test.js

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: tests/performance/results/
```

### 3.2 Lighthouse CI Configuration

Create `lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "ready on",
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/bills",
        "http://localhost:3000/legislators",
        "http://localhost:3000/votes",
        "http://localhost:3000/about",
        "http://localhost:3000/privacy"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "throttling": {
          "rttMs": 40,
          "throughputKbps": 10240,
          "cpuSlowdownMultiplier": 1
        }
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["error", {"minScore": 0.9}],
        "categories:seo": ["error", {"minScore": 0.9}],

        "first-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 300}],
        "speed-index": ["error", {"maxNumericValue": 3000}],

        "interactive": ["error", {"maxNumericValue": 4000}],
        "max-potential-fid": ["error", {"maxNumericValue": 100}],

        "resource-summary:script:size": ["error", {"maxNumericValue": 250000}],
        "resource-summary:stylesheet:size": ["error", {"maxNumericValue": 50000}],
        "resource-summary:document:size": ["error", {"maxNumericValue": 50000}],
        "resource-summary:image:size": ["error", {"maxNumericValue": 500000}],
        "resource-summary:total:size": ["error", {"maxNumericValue": 1000000}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### 3.3 Performance Budget Enforcement

**Progressive Rollout Strategy**:

1. **Phase 1 (Week 1-2)**: Establish baselines
   - Run tests, collect data
   - Set budgets to warn only
   - Do not block CI

2. **Phase 2 (Week 3-4)**: Warn on violations
   - Enable warnings in PR comments
   - Track violations, do not block
   - Educate team on budgets

3. **Phase 3 (Week 5+)**: Enforce budgets
   - Block PRs exceeding budgets
   - Require performance justification
   - Full enforcement active

---

## 4. Production Monitoring Strategy

### 4.1 Real User Monitoring (RUM)

#### Implementation: Web Vitals API

Create `apps/web/src/lib/monitoring/web-vitals.ts`:

```typescript
import { onCLS, onFCP, onFID, onLCP, onTTFB, onINP } from 'web-vitals';

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

function sendToAnalytics(metric: WebVitalsMetric) {
  // Send to your analytics endpoint
  const body = JSON.stringify({
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
    page: window.location.pathname,
    timestamp: Date.now(),
  });

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    fetch('/api/analytics/vitals', {
      body,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }
}

export function initWebVitals() {
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);
}
```

#### Analytics Endpoint

Create `apps/api/src/routes/analytics.ts`:

```typescript
import { Router } from 'express';
import { logger } from '../lib/logger.js';

export const analyticsRouter = Router();

analyticsRouter.post('/vitals', async (req, res) => {
  try {
    const { metric, value, rating, page, timestamp } = req.body;

    // Log structured metrics
    logger.info({
      type: 'web_vitals',
      metric,
      value,
      rating,
      page,
      timestamp,
      userAgent: req.headers['user-agent'],
    });

    // TODO: Store in time-series database (Prometheus, InfluxDB, etc.)

    res.status(204).end();
  } catch (error) {
    logger.error('Failed to record web vitals', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 4.2 Backend Monitoring

#### Prometheus Metrics

Install dependencies:
```bash
cd apps/api
npm install --save prom-client
```

Create `apps/api/src/lib/metrics.ts`:

```typescript
import client from 'prom-client';

// Create a Registry
export const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'],
  registers: [register],
});
```

#### Metrics Middleware

Create `apps/api/src/middleware/metrics.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../lib/metrics.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
}
```

#### Metrics Endpoint

Add to `apps/api/src/index.ts`:

```typescript
import { register } from './lib/metrics.js';
import { metricsMiddleware } from './middleware/metrics.js';

// Add metrics middleware
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 4.3 Monitoring Stack

#### Docker Compose for Monitoring

Create `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: ltip-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:10.1.0
    container_name: ltip-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    networks:
      - monitoring
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
    driver: bridge
```

#### Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ltip-api'
    static_configs:
      - targets: ['host.docker.internal:4001']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### 4.4 Alert Configuration

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: performance_alerts
    interval: 30s
    rules:
      # API Response Time
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 2.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency on {{ $labels.route }}"
          description: "P95 latency is {{ $value }}s (threshold: 2.5s)"

      - alert: CriticalAPILatency
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 5.0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Critical API latency on {{ $labels.route }}"
          description: "P95 latency is {{ $value }}s (threshold: 5.0s)"

      # Error Rate
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: CriticalErrorRate
        expr: sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Critical error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Database Performance
      - alert: SlowDatabaseQueries
        expr: histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket[5m])) by (le, operation)) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries"
          description: "P95 query time for {{ $labels.operation }} is {{ $value }}s"
```

### 4.5 Grafana Dashboards

Key dashboards to create:

1. **Core Web Vitals Dashboard**
   - LCP, FID, CLS, FCP, TTFB, INP over time
   - By page route
   - Rating distribution (good/needs-improvement/poor)

2. **API Performance Dashboard**
   - Request rate (requests/sec)
   - Response time percentiles (p50, p95, p99)
   - Error rate
   - Top slow endpoints

3. **Database Performance Dashboard**
   - Query duration by operation
   - Connection pool usage
   - Slow query log

4. **System Resources Dashboard**
   - CPU usage
   - Memory usage
   - Active connections
   - Event loop lag

---

## 5. Potential Bottlenecks to Test

### 5.1 Critical Bottlenecks (High Priority)

#### Database Query Performance
**Issue**: N+1 queries, missing indexes, inefficient joins
**Test Approach**:
- Profile with `EXPLAIN ANALYZE` on all endpoints
- Monitor query count per request
- Check for sequential scans

**Tools**:
- Prisma query logging
- PostgreSQL `pg_stat_statements`
- `EXPLAIN ANALYZE` output

**Expected Findings**:
- List endpoints likely doing N+1 queries for relations
- Missing indexes on foreign keys
- Inefficient COUNT queries

**Mitigation Strategy**:
- Add database indexes
- Use `include` in Prisma queries
- Implement cursor-based pagination
- Add query result caching

#### API Response Serialization
**Issue**: Large JSON payloads, inefficient serialization
**Test Approach**:
- Measure serialization time with profiler
- Test with varying dataset sizes
- Monitor memory usage during serialization

**Tools**:
- clinic.js Doctor
- Node.js built-in profiler
- Memory snapshots

**Expected Findings**:
- Large arrays causing memory pressure
- Circular reference checks overhead
- Unnecessary data in responses

**Mitigation Strategy**:
- Implement field selection (GraphQL-style)
- Use streaming for large datasets
- Consider protobuf for binary serialization

#### Frontend Bundle Size
**Issue**: Large JavaScript bundles slow initial load
**Test Approach**:
- Analyze bundle with webpack-bundle-analyzer
- Test with throttled network (3G, 4G)
- Measure parse/compile time

**Tools**:
- Next.js Bundle Analyzer
- Chrome DevTools Coverage
- Lighthouse unused JavaScript audit

**Expected Findings**:
- Unnecessary dependencies
- Duplicate code in chunks
- Large third-party libraries

**Mitigation Strategy**:
- Code splitting by route
- Dynamic imports for heavy components
- Tree shaking optimization
- Replace heavy dependencies

### 5.2 Secondary Bottlenecks (Medium Priority)

#### Authentication Overhead
**Issue**: JWT verification on every request
**Test Approach**:
- Benchmark auth middleware
- Test with/without caching
- Profile cryptographic operations

**Mitigation Strategy**:
- Cache decoded JWTs (short TTL)
- Use faster algorithms if possible
- Implement token blacklist efficiently

#### WebSocket Connection Management
**Issue**: Connection pooling, message throughput
**Test Approach**:
- Test concurrent connections (100, 500, 1000)
- Measure message latency
- Monitor memory per connection

**Tools**:
- Artillery WebSocket scenarios
- ws library debugging
- Connection stats logging

#### Static Asset Delivery
**Issue**: Unoptimized images, missing caching
**Test Approach**:
- Audit all static assets
- Test cache headers
- Measure CDN performance

**Mitigation Strategy**:
- Next.js Image optimization
- Implement CDN (Vercel, Cloudflare)
- Aggressive browser caching
- WebP/AVIF formats

### 5.3 Bottleneck Testing Matrix

| Bottleneck | Test Type | Load Level | Duration | Success Criteria |
|-----------|-----------|------------|----------|------------------|
| Database queries | Load | 50 VUs | 10 min | p95 < 500ms |
| Serialization | Load | 50 VUs | 10 min | Memory < 512MB |
| Bundle size | Lighthouse | N/A | Per run | Total < 300KB |
| Auth overhead | Stress | 100 VUs | 15 min | p95 < 50ms |
| WebSocket | Spike | 200 conns | 5 min | No dropped messages |
| Static assets | Lighthouse | N/A | Per run | LCP < 2.5s |

---

## 6. Test Scenarios Specification

### 6.1 k6 Test Scripts

#### Basic API Test Template

Create `tests/performance/api-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const billsLatency = new Trend('bills_latency');
const legislatorsLatency = new Trend('legislators_latency');
const votesLatency = new Trend('votes_latency');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.01'],
    http_req_duration: ['p95<2500', 'p99<5000'],
    bills_latency: ['p95<700'],
    legislators_latency: ['p95<700'],
    votes_latency: ['p95<900'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4001';

export default function () {
  // Test bills endpoint
  let billsRes = http.get(`${BASE_URL}/api/bills?page=1&limit=50`);
  billsLatency.add(billsRes.timings.duration);
  check(billsRes, {
    'bills status 200': (r) => r.status === 200,
    'bills has data': (r) => JSON.parse(r.body).data.length > 0,
  }) || errorRate.add(1);

  sleep(1);

  // Test legislators endpoint
  let legisRes = http.get(`${BASE_URL}/api/legislators?page=1&limit=50`);
  legislatorsLatency.add(legisRes.timings.duration);
  check(legisRes, {
    'legislators status 200': (r) => r.status === 200,
    'legislators has data': (r) => JSON.parse(r.body).data.length > 0,
  }) || errorRate.add(1);

  sleep(1);

  // Test votes endpoint
  let votesRes = http.get(`${BASE_URL}/api/votes?page=1&limit=50`);
  votesLatency.add(votesRes.timings.duration);
  check(votesRes, {
    'votes status 200': (r) => r.status === 200,
    'votes has data': (r) => r.body.includes('data'),
  }) || errorRate.add(1);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'results/summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

#### Authenticated User Journey

Create `tests/performance/user-journey.js`:

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    user_journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 },
      ],
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4001';

export default function () {
  let authToken;

  group('Authentication', () => {
    const loginPayload = JSON.stringify({
      email: 'test@example.com',
      password: 'Test123!',
    });

    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginRes, {
      'login successful': (r) => r.status === 200,
    });

    authToken = loginRes.json('token');
  });

  sleep(1);

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  group('Browse Bills', () => {
    const billsRes = http.get(`${BASE_URL}/api/bills`, { headers });
    check(billsRes, { 'bills loaded': (r) => r.status === 200 });

    // Simulate clicking on a bill
    const bills = billsRes.json('data');
    if (bills && bills.length > 0) {
      const billId = bills[0].id;
      const billRes = http.get(`${BASE_URL}/api/bills/${billId}`, { headers });
      check(billRes, { 'bill detail loaded': (r) => r.status === 200 });
    }
  });

  sleep(2);

  group('Browse Legislators', () => {
    const legisRes = http.get(`${BASE_URL}/api/legislators`, { headers });
    check(legisRes, { 'legislators loaded': (r) => r.status === 200 });
  });

  sleep(2);

  group('View Votes', () => {
    const votesRes = http.get(`${BASE_URL}/api/votes`, { headers });
    check(votesRes, { 'votes loaded': (r) => r.status === 200 });
  });

  sleep(1);
}
```

### 6.2 Artillery Scenarios

Create `tests/performance/websocket-test.yml`:

```yaml
config:
  target: 'ws://localhost:4001'
  phases:
    - duration: 60
      arrivalRate: 5
      name: Warm up
    - duration: 120
      arrivalRate: 10
      name: Sustained load
    - duration: 60
      arrivalRate: 5
      name: Cool down
  plugins:
    metrics-by-endpoint:
      stripQueryString: true

scenarios:
  - name: "WebSocket Connection Test"
    engine: ws
    flow:
      - think: 1
      - send: '{"type":"subscribe","channel":"bills"}'
      - think: 2
      - send: '{"type":"ping"}'
      - think: 5
      - send: '{"type":"unsubscribe","channel":"bills"}'
      - think: 1
```

---

## 7. Profiling and Diagnostics

### 7.1 Backend Profiling

#### clinic.js Doctor (CPU profiling)

```bash
# Install
npm install -g clinic

# Profile API server
clinic doctor -- node dist/index.js

# Generate flamegraph
clinic flame -- node dist/index.js

# Detect event loop issues
clinic bubbleprof -- node dist/index.js
```

#### Node.js Built-in Profiler

```bash
# Start with --inspect flag
node --inspect dist/index.js

# Chrome DevTools
# Open chrome://inspect
# Click "inspect" on your Node process
# Go to Profiler tab
```

### 7.2 Frontend Profiling

#### Next.js Bundle Analyzer

```bash
# Install
npm install --save-dev @next/bundle-analyzer

# Configure next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... existing config
});

# Run analysis
ANALYZE=true npm run build
```

#### Chrome DevTools Performance

1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Perform actions
5. Stop recording
6. Analyze:
   - Main thread activity
   - Long tasks
   - Rendering bottlenecks
   - Memory allocation

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Tasks**:
1. Install and configure k6
2. Install and configure Lighthouse CI
3. Set up basic monitoring (Prometheus + Grafana)
4. Create baseline smoke test

**Deliverables**:
- k6 installed and verified
- Lighthouse CI configuration
- Prometheus scraping API metrics
- Grafana dashboards (basic)

**Effort**: 8 hours

### Phase 2: Baseline Establishment (Week 1-2)

**Tasks**:
1. Run Lighthouse on all 6 pages (3 runs each)
2. Run k6 load test on API endpoints
3. Document current performance (p50/p95/p99)
4. Establish performance budgets

**Deliverables**:
- Performance baseline document
- Budget configuration files
- Initial bottleneck identification

**Effort**: 8 hours

### Phase 3: Test Suite Development (Week 2)

**Tasks**:
1. Create k6 test scenarios (smoke, load, stress, spike, soak)
2. Create Artillery WebSocket test
3. Create authenticated user journey test
4. Add result reporting

**Deliverables**:
- Complete k6 test suite
- Artillery WebSocket test
- Documentation for running tests

**Effort**: 10 hours

### Phase 4: CI/CD Integration (Week 2)

**Tasks**:
1. Create GitHub Actions workflow
2. Configure Lighthouse CI assertions
3. Set up test result artifacts
4. Create PR comment bot (optional)

**Deliverables**:
- Automated performance testing in CI
- PR performance reports
- Performance gate (warn mode initially)

**Effort**: 6 hours

### Phase 5: Production Monitoring (Week 3)

**Tasks**:
1. Implement Web Vitals RUM
2. Add API analytics endpoint
3. Configure Prometheus alerts
4. Create production dashboards

**Deliverables**:
- Real user monitoring active
- Alert rules configured
- Production dashboards

**Effort**: 8 hours

### Phase 6: Comprehensive Testing & Documentation (Week 3)

**Tasks**:
1. Execute full test suite
2. Profile bottlenecks with clinic.js
3. Analyze bundle with Bundle Analyzer
4. Document findings and recommendations

**Deliverables**:
- Complete test results
- Bottleneck analysis report
- Performance improvement recommendations
- Final documentation

**Effort**: 8 hours

---

## 9. Success Criteria

### 9.1 Completion Criteria

- [ ] All 5 k6 test scenarios implemented and passing
- [ ] Lighthouse CI integrated with GitHub Actions
- [ ] Performance budgets established for all 6 pages
- [ ] Automated regression testing active (warn mode minimum)
- [ ] Production monitoring deployed (Prometheus + Grafana)
- [ ] Web Vitals RUM collecting data
- [ ] Alert rules configured and tested
- [ ] At least 3 bottlenecks identified and documented
- [ ] Performance improvement backlog created

### 9.2 Quality Gates

**Frontend**:
- All pages achieve Lighthouse performance score ≥ 90
- Core Web Vitals in "Good" range for ≥ 75% of users
- Total bundle size < 300KB per page
- No blocking resources > 500KB

**Backend**:
- API p95 latency < 2.5s under normal load (50 VUs)
- Error rate < 1% under stress (100 VUs)
- System stable during 4-hour soak test
- No memory leaks detected

**CI/CD**:
- Performance tests run on every PR
- Results visible in PR comments
- Budget violations logged (warn initially)
- No false positives in test runs

---

## 10. Risks and Mitigation

### 10.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| No existing baseline data | High | Certain | Establish baseline in Phase 2 before enforcement |
| Flaky performance tests | Medium | High | Use multiple runs, statistical analysis, wider thresholds initially |
| CI/CD pipeline slowdown | Medium | Medium | Run full tests only on main branch, smoke tests on PRs |
| Monitoring overhead | Low | Medium | Sample RUM data (10% of users initially), optimize Prometheus queries |
| Team resistance to budgets | Medium | Medium | Progressive rollout (warn → soft block → hard block), education sessions |
| Production data differs from test | High | Medium | Use production-like data volume, test with real-world scenarios |

### 10.2 Contingency Plans

**If tests are too slow**:
- Reduce test duration
- Parallelize where possible
- Use matrix strategy in GitHub Actions

**If budgets too strict**:
- Adjust targets based on baseline
- Focus on preventing regressions, not absolute targets
- Prioritize critical pages (/bills, /legislators, /votes)

**If monitoring overhead too high**:
- Sample metrics (e.g., 10% of requests)
- Reduce scrape frequency
- Use aggregation before storage

---

## 11. Maintenance and Evolution

### 11.1 Ongoing Activities

**Weekly**:
- Review performance dashboards
- Check for new violations
- Run full load test suite

**Monthly**:
- Review and adjust performance budgets
- Update test scenarios based on new features
- Analyze trends and patterns
- Stress test to find new limits

**Quarterly**:
- Comprehensive performance audit
- Review monitoring stack effectiveness
- Update tooling and dependencies
- Team training on performance best practices

### 11.2 Budget Review Process

1. Collect 30 days of production data
2. Calculate p50/p95/p99 for each metric
3. Compare against current budgets
4. Adjust budgets if:
   - Consistently exceeding (>80% of time)
   - Consistently under (>80% of time, room to tighten)
   - New features changed expectations
5. Document changes and rationale
6. Update CI configuration

---

## 12. Cost Analysis

### 12.1 Tooling Costs

| Tool | Cost | Billing |
|------|------|---------|
| k6 OSS | Free | N/A |
| k6 Cloud (optional) | $49/mo | Pay-as-you-go for cloud runs |
| Lighthouse CI | Free | N/A |
| Artillery OSS | Free | N/A |
| Prometheus | Free | Self-hosted |
| Grafana OSS | Free | Self-hosted |
| Grafana Cloud (optional) | $0 (free tier) | Usage-based |

**Total Monthly Cost (baseline)**: $0
**Total Monthly Cost (with k6 Cloud)**: ~$50

### 12.2 Infrastructure Costs

**Development/Staging**:
- Monitoring stack: ~$20/mo (DigitalOcean Droplet or similar)

**Production** (if self-hosting monitoring):
- Prometheus + Grafana: ~$40/mo (2GB RAM, 2 vCPU)

**Estimated Total**: $60-110/mo

### 12.3 Time Investment

**Initial Setup**: 40 hours
**Ongoing Maintenance**: 4 hours/week
**Quarterly Audits**: 8 hours/quarter

---

## 13. Deliverables Checklist

### Documentation
- [x] This performance validation plan
- [ ] Test execution guide
- [ ] Monitoring setup guide
- [ ] Alert playbook
- [ ] Performance optimization guide

### Configuration Files
- [ ] `lighthouserc.json`
- [ ] `tests/performance/smoke-test.js`
- [ ] `tests/performance/load-test.js`
- [ ] `tests/performance/stress-test.js`
- [ ] `tests/performance/spike-test.js`
- [ ] `tests/performance/soak-test.js`
- [ ] `.github/workflows/performance.yml`
- [ ] `monitoring/prometheus.yml`
- [ ] `monitoring/alerts.yml`
- [ ] `docker-compose.monitoring.yml`

### Code Implementations
- [ ] `apps/web/src/lib/monitoring/web-vitals.ts`
- [ ] `apps/api/src/routes/analytics.ts`
- [ ] `apps/api/src/lib/metrics.ts`
- [ ] `apps/api/src/middleware/metrics.ts`

### Reports
- [ ] Baseline performance report
- [ ] Bottleneck analysis report
- [ ] Load test results
- [ ] Lighthouse audit results
- [ ] Performance improvement recommendations

---

## 14. Next Steps

1. **Review and Approval** (Day 1)
   - Review this plan with team
   - Adjust budgets if needed
   - Approve tool selection
   - Allocate resources

2. **Kickoff** (Day 2)
   - Create WP11 tracking issue
   - Set up project board
   - Schedule check-ins
   - Begin Phase 1

3. **Execution** (Days 3-14)
   - Follow implementation roadmap
   - Document findings daily
   - Update stakeholders weekly
   - Adjust plan as needed

4. **Completion** (Day 15)
   - Final report
   - Team presentation
   - Handoff to operations
   - Create performance improvement backlog

---

## Appendix A: Tool Installation

### k6

**macOS**:
```bash
brew install k6
```

**Linux**:
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Lighthouse CI

```bash
npm install -g @lhci/cli@0.13.x
```

### clinic.js

```bash
npm install -g clinic
```

---

## Appendix B: Useful Commands

### k6

```bash
# Run smoke test
k6 run tests/performance/smoke-test.js

# Run with custom VUs
k6 run --vus 10 --duration 30s tests/performance/load-test.js

# Run with environment variables
k6 run -e API_URL=https://api.example.com tests/performance/load-test.js

# Output to JSON
k6 run --out json=results.json tests/performance/load-test.js

# View results summary
k6 run --summary-export=summary.json tests/performance/load-test.js
```

### Lighthouse CI

```bash
# Run locally
lhci autorun

# Collect only
lhci collect --url=http://localhost:3000

# Assert only
lhci assert --preset=lighthouse:recommended

# Upload results
lhci upload --target=temporary-public-storage
```

### Prometheus

```bash
# Check config
promtool check config monitoring/prometheus.yml

# Check rules
promtool check rules monitoring/alerts.yml

# Query from CLI
curl 'http://localhost:9090/api/v1/query?query=up'
```

---

## Appendix C: Performance Budget Templates

### Conservative Budget (New Features)

```json
{
  "LCP": 3000,
  "FID": 150,
  "CLS": 0.15,
  "FCP": 2000,
  "TTFB": 1000,
  "INP": 250
}
```

### Aggressive Budget (Established Pages)

```json
{
  "LCP": 2000,
  "FID": 75,
  "CLS": 0.08,
  "FCP": 1500,
  "TTFB": 600,
  "INP": 150
}
```

---

## Appendix D: References

- [Web Vitals](https://web.dev/vitals/)
- [k6 Documentation](https://k6.io/docs/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

---

**Document Status**: Ready for Execution
**Last Updated**: 2026-01-31
**Maintained By**: LTIP Performance Team
