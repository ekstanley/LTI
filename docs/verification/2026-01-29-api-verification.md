# LTIP API Endpoint Verification Report

**Date**: 2026-01-29
**Version**: 0.5.0
**Environment**: Development (localhost:4000)

---

## Summary

| Category | Passed | Failed | Total | Pass Rate |
|----------|--------|--------|-------|-----------|
| Health & Core | 5 | 0 | 5 | **100%** |
| Bills Detail | 3 | 2 | 5 | **60%** |
| Legislators Detail | 4 | 1 | 5 | **80%** |
| Votes Detail | 3 | 0 | 3 | **100%** |
| Search | 2 | 0 | 2 | **100%** |
| **Total** | **17** | **3** | **20** | **85%** |

---

## Detailed Results

### Health & Core Endpoints

| Endpoint | Status | Result |
|----------|--------|--------|
| `GET /api/health` | 200 | PASS |
| `GET /api/v1/bills?limit=5` | 200 | PASS |
| `GET /api/v1/legislators?limit=5` | 200 | PASS |
| `GET /api/v1/votes?limit=5` | 200 | PASS |
| `GET /api/v1/committees?limit=5` | 200 | PASS |

### Bills Detail Endpoints

| Endpoint | Expected | Actual | Result | Notes |
|----------|----------|--------|--------|-------|
| `GET /api/v1/bills/hr-2-119` | 200 | 500 | **FAIL** | Internal server error - needs investigation |
| `GET /api/v1/bills/hr-2-119/sponsors` | 200 | 404 | **FAIL** | Endpoint may use different path (cosponsors) |
| `GET /api/v1/bills/hr-2-119/actions` | 200 | 200 | PASS | |
| `GET /api/v1/bills/hr-2-119/text` | 200 | 200 | PASS | |
| `GET /api/v1/bills/hr-2-119/related` | 200 | 200 | PASS | |

### Legislators Detail Endpoints

| Endpoint | Expected | Actual | Result | Notes |
|----------|----------|--------|--------|-------|
| `GET /api/v1/legislators/A000002` | 200 | 200 | PASS | |
| `GET /api/v1/legislators/A000002/committees` | 200 | 200 | PASS | |
| `GET /api/v1/legislators/A000002/bills` | 200 | 200 | PASS | |
| `GET /api/v1/legislators/A000002/voting-record` | 200 | 404 | **FAIL** | Uses `/votes` endpoint instead |
| `GET /api/v1/legislators/A000002/stats` | 200 | 200 | PASS | |

### Votes Detail Endpoints

| Endpoint | Status | Result |
|----------|--------|--------|
| `GET /api/v1/votes` | 200 | PASS |
| `GET /api/v1/votes/recent/house` | 200 | PASS |
| `GET /api/v1/votes/recent/senate` | 200 | PASS |

### Search Endpoints

| Endpoint | Status | Result |
|----------|--------|--------|
| `GET /api/v1/bills?q=tax` | 200 | PASS |
| `GET /api/v1/legislators?party=D&limit=5` | 200 | PASS |

---

## Failed Endpoint Analysis

### 1. `/api/v1/bills/hr-2-119` - 500 Error

**Priority**: HIGH
**Root Cause**: Likely Prisma query error or malformed bill ID handling
**Recommendation**: Check bills route handler for ID parsing and include relation errors

### 2. `/api/v1/bills/hr-2-119/sponsors` - 404

**Priority**: MEDIUM
**Root Cause**: Route not implemented - gap analysis shows endpoint as `/cosponsors`
**Recommendation**: Verify correct endpoint path in route definitions

### 3. `/api/v1/legislators/A000002/voting-record` - 404

**Priority**: MEDIUM
**Root Cause**: Gap analysis shows endpoint as `/votes` not `/voting-record`
**Recommendation**: Standardize endpoint naming or add alias

---

## Recommendations

1. **Immediate**: Fix 500 error on bill detail endpoint
2. **Short-term**: Align endpoint naming conventions with specification
3. **Documentation**: Update API docs to reflect actual endpoint paths

---

## Verification Metadata

```json
{
  "timestamp": "2026-01-29T21:40:34Z",
  "apiVersion": "0.5.0",
  "baseUrl": "http://localhost:4000/api",
  "totalEndpoints": 20,
  "passRate": 0.85
}
```
