# LTI Performance Testing with k6

This directory contains k6 load test scripts for the LTI API endpoints. These tests establish performance baselines and help identify bottlenecks under load.

## Prerequisites

1. **k6 installed** (v1.4.2 or higher):
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   choco install k6

   # Verify installation
   k6 version
   ```

2. **API server running**:
   ```bash
   # From project root
   pnpm --filter=@ltip/api dev

   # Verify server is running
   curl http://localhost:4000/api/health
   ```

## Test Scripts

| Script | Endpoints Tested | Description |
|--------|------------------|-------------|
| `bills.js` | 7 endpoints | Bills API (list, details, sponsors, cosponsors, actions, text, related) |
| `legislators.js` | 3 endpoints | Legislators API (list, details, committees) |
| `votes.js` | 3 endpoints | Votes API (list, details, breakdown) |
| `conflicts.js` | 2 endpoints | Conflicts API (list, details) - placeholder for future |
| `auth.js` | 5 endpoints | Auth API (register, login, refresh, logout, profile) |
| `analysis.js` | 2 endpoints | Analysis API (get, generate) - placeholder for future |

**Total: 22 API endpoints tested**

## Load Profiles

Each script supports three load profiles:

### Light Profile
- **VUs**: 5-10 virtual users
- **Duration**: ~1 minute
- **Use case**: Quick smoke test, CI/CD validation
- **Thresholds**: P95 < 500ms, P99 < 1000ms, Error rate < 1%

### Medium Profile (Default)
- **VUs**: 20-50 virtual users
- **Duration**: ~2 minutes
- **Use case**: Standard load testing, baseline establishment
- **Thresholds**: P95 < 800ms, P99 < 1500ms, Error rate < 1%

### Heavy Profile
- **VUs**: 50-100 virtual users
- **Duration**: ~3 minutes
- **Use case**: Stress testing, capacity planning
- **Thresholds**: P95 < 1000ms, P99 < 2000ms, Error rate < 2%

## Running Tests

### Basic Usage

```bash
# Run with default (medium) profile
k6 run bills.js

# Run with specific profile
k6 run -e PROFILE=light bills.js
k6 run -e PROFILE=heavy legislators.js

# Custom API URL
k6 run -e BASE_URL=http://localhost:4000 votes.js

# Combine options
k6 run -e PROFILE=heavy -e BASE_URL=http://api.example.com auth.js
```

### Run All Tests

```bash
# Run all test scripts with medium profile
for script in bills.js legislators.js votes.js conflicts.js auth.js analysis.js; do
  echo "Running $script..."
  k6 run "$script"
  echo "---"
done

# Light profile for all tests
for script in *.js; do
  [ "$script" = "README.md" ] && continue
  k6 run -e PROFILE=light "$script"
done
```

### CI/CD Integration

```bash
# Quick smoke test (light profile, fail on threshold violations)
k6 run --quiet -e PROFILE=light bills.js

# Exit codes:
# 0 = success (all thresholds passed)
# 1 = failure (one or more thresholds failed)
```

## Understanding Results

### Console Output

k6 provides detailed metrics in the console:

```
execution: local
     script: bills.js
     output: -

scenarios: (100.00%) 1 scenario, 50 max VUs, 2m20s max duration

running (2m00.1s), 00/50 VUs, 1234 complete and 0 interrupted iterations

✓ status is 200
✓ response has body
✓ response time < 2s

checks.........................: 100.00% ✓ 3702      ✗ 0
data_received..................: 2.1 MB  17 kB/s
data_sent......................: 123 kB  1.0 kB/s
http_req_duration..............: avg=234.56ms min=45.12ms med=198.34ms max=987.65ms p(90)=356.78ms p(95)=456.89ms
http_req_failed................: 0.00%   ✓ 0         ✗ 1234
http_reqs......................: 1234    10.28/s
iterations.....................: 1234    10.28/s
vus............................: 50      min=0       max=50
vus_max........................: 50      min=50      max=50

list_bills_duration............: avg=256.78ms min=67.89ms med=234.56ms max=876.54ms p(90)=387.65ms p(95)=478.90ms
get_bill_duration..............: avg=178.90ms min=34.56ms med=167.89ms max=567.89ms p(90)=278.90ms p(95)=345.67ms
```

### Key Metrics

- **http_req_duration**: Response time (P50, P95, P99 are most important)
- **http_req_failed**: Error rate (should be < 1-2%)
- **http_reqs**: Throughput (requests per second)
- **checks**: Pass rate for assertions
- **Custom metrics**: Endpoint-specific response times

### JSON Output

Save detailed results to JSON:

```bash
k6 run --out json=results.json bills.js

# Each test also creates a summary JSON file automatically
# - bills-summary.json
# - legislators-summary.json
# - etc.
```

## Performance Baselines

See [BASELINE_METRICS.md](BASELINE_METRICS.md) for established performance baselines.

**Target Metrics** (for medium profile):
- **P50 latency**: < 200ms
- **P95 latency**: < 800ms
- **P99 latency**: < 1500ms
- **Throughput**: > 50 req/s
- **Error rate**: < 1%

## Interpreting Thresholds

Each script defines thresholds that must be met:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<800', 'p(99)<1500'],  // 95% under 800ms, 99% under 1500ms
  'http_req_failed': ['rate<0.01'],                   // Less than 1% errors
  'list_bills_duration': ['p(95)<600'],               // Endpoint-specific threshold
}
```

- ✅ **Green check**: Threshold passed
- ❌ **Red X**: Threshold failed (test exits with code 1)

## Troubleshooting

### API Server Not Running

```
Error: API health check failed: ECONNREFUSED
```

**Solution**: Start the API server:
```bash
pnpm --filter=@ltip/api dev
```

### High Error Rate

```
http_req_failed................: 15.23% ✓ 187       ✗ 1047
```

**Possible causes**:
- API server overloaded
- Database connection pool exhausted
- Rate limiting triggered
- Invalid test data (IDs don't exist)

**Solution**: Check API logs and reduce load profile

### Threshold Failures

```
✗ http_req_duration: ['p(95)<800']
```

**Analysis**:
1. Check which endpoints are slow (custom metrics)
2. Review API server logs
3. Check database query performance
4. Consider optimizing slow endpoints

### Memory Issues

**Symptoms**: k6 crashes, system slowdown

**Solution**: Reduce VUs in load profile or use distributed testing

## Advanced Usage

### Custom Scenarios

Modify load patterns in script:

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Sustained
    { duration: '30s', target: 100 }, // Spike
    { duration: '1m', target: 50 },   // Recover
    { duration: '30s', target: 0 },   // Ramp down
  ],
};
```

### Distributed Testing

For very high load, use k6 cloud or multiple machines:

```bash
# Run on multiple machines
k6 run --vus 50 bills.js  # Machine 1
k6 run --vus 50 bills.js  # Machine 2
# = 100 total VUs
```

### Integration with Monitoring

Export metrics to external systems:

```bash
# InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 bills.js

# Prometheus (via Prometheus Remote Write)
k6 run --out experimental-prometheus-rw bills.js

# Grafana Cloud
k6 run --out cloud bills.js
```

## Best Practices

1. **Run tests regularly**: Establish baseline, track over time
2. **Test in isolation**: One script at a time for accurate metrics
3. **Monitor API server**: Watch CPU, memory, database during tests
4. **Start small**: Use light profile first, increase gradually
5. **Clean up**: Remove test users created by auth.js
6. **Document changes**: Update baselines when API changes
7. **Use in CI/CD**: Catch performance regressions early

## Notes

- **Conflicts API**: Currently returns empty data (feature not implemented)
- **Analysis API**: Currently returns 404/placeholder (feature not implemented)
- **Auth tests**: Create temporary users - consider cleanup
- **Test data**: Uses sample IDs - update with real IDs for better results

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 HTTP API](https://k6.io/docs/javascript-api/k6-http/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [LTI API Documentation](../../docs/api/README.md)

## Contributing

When adding new API endpoints:

1. Update relevant test script or create new one
2. Add appropriate load profile and thresholds
3. Run baseline tests and document results
4. Update this README with new endpoint information
5. Add to CI/CD pipeline

---

**Version**: 1.0.0
**Last Updated**: 2026-02-01
**Maintained by**: Agent 3 (Performance Testing)
