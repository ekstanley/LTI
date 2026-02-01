# BLOCKER-001 Remediation Guide

**Issue**: Frontend data loading failure - all pages show perpetual loading spinners
**Root Cause**: CORS configuration mismatch between frontend port (3012) and API allowed origins (3000)
**Status**: Ready for implementation
**Created**: 2026-01-30

---

## Problem Analysis

### Root Cause Identified

```
apps/api/src/config.ts:13
┌─────────────────────────────────────────────────────────────────┐
│ CORS_ORIGINS: z.string().default('http://localhost:3000')      │
│                                                                 │
│ ❌ PROBLEM: Only allows port 3000                              │
│ ✅ SOLUTION: Must include port 3012 (actual frontend port)     │
└─────────────────────────────────────────────────────────────────┘
```

### How CORS Works in This Codebase

1. **Environment Variable**: `.env` file contains `CORS_ORIGINS`
2. **Config Parsing**: `apps/api/src/config.ts:73` splits by comma
3. **Middleware**: `apps/api/src/index.ts:66` applies CORS policy

```typescript
// apps/api/src/config.ts:73
corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
```

This means we can specify multiple origins using comma-separated values.

---

## Step 1: Update .env File (REQUIRED)

### File Location
```
/Users/estanley/Documents/GitHub/LTI/.env
```

### Required Change

**Find this line** (approximately line 38):
```bash
CORS_ORIGINS=http://localhost:3000
```

**Replace with**:
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:3012,http://localhost:3001
```

### Explanation
- `http://localhost:3000` - Standard Next.js development port
- `http://localhost:3012` - Current production build port (verified in previous session)
- `http://localhost:3001` - Alternative development port (for flexibility)

---

## Step 2: Verify Frontend API URL Configuration

### File Location
```
/Users/estanley/Documents/GitHub/LTI/.env
```

### Required Line (verify exists, approximately line 50):
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

This variable tells the frontend where to send API requests.

---

## Step 3: Restart Services

After updating the `.env` file, restart both services to apply changes:

```bash
# Stop all services
pkill -f "next start"
pkill -f "tsx watch"

# Start API server
cd /Users/estanley/Documents/GitHub/LTI
pnpm --filter @ltip/api run dev &

# Wait for API to start
sleep 5

# Start frontend
pnpm --filter @ltip/web run start -p 3012 &

# Wait for frontend to start
sleep 8
```

---

## Step 4: Verification Tests

### Test 1: CORS Headers
```bash
# Should return Access-Control-Allow-Origin: http://localhost:3012
curl -v -H "Origin: http://localhost:3012" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:4000/api/v1/bills 2>&1 | grep -i "access-control"
```

**Expected Output**:
```
< Access-Control-Allow-Origin: http://localhost:3012
< Access-Control-Allow-Credentials: true
```

### Test 2: API Health Check
```bash
curl -s http://localhost:4000/api/health | jq '.'
```

**Expected Output**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T...",
  "uptime": 123.456,
  "environment": "development"
}
```

### Test 3: Frontend Data Loading
```bash
# Test homepage (should return 200)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3012/

# Test bills page (should return 200)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3012/bills

# Test legislators page (should return 200)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3012/legislators

# Test votes page (should return 200)
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3012/votes
```

**Expected Output** (all pages):
```
HTTP 200
```

### Test 4: Browser Console Check

Open browser to `http://localhost:3012/bills` and check console (F12):

**BEFORE FIX** (current state):
```
❌ CORS error: Access to fetch at 'http://localhost:4000/api/v1/bills'
   from origin 'http://localhost:3012' has been blocked by CORS policy
```

**AFTER FIX** (expected state):
```
✅ Successfully loaded bills
✅ Successfully loaded legislators
✅ Successfully loaded votes
```

---

## Implementation Checklist

- [ ] **Step 1**: Update `.env` file with new CORS_ORIGINS value
- [ ] **Step 2**: Verify NEXT_PUBLIC_API_URL is set correctly
- [ ] **Step 3**: Restart both API and frontend services
- [ ] **Step 4**: Run verification tests
  - [ ] CORS headers test passes
  - [ ] API health check returns 200
  - [ ] All frontend pages return HTTP 200
  - [ ] Browser console shows no CORS errors
  - [ ] Data loads successfully on all pages

---

## Architecture Context

### Files Involved

1. **`.env`** - Environment variables (ROOT CAUSE LOCATION)
   - Contains `CORS_ORIGINS` configuration
   - Must be updated manually (read-protected for security)

2. **`apps/api/src/config.ts:13`** - Config schema
   - Defines Zod validation for environment variables
   - Default: `'http://localhost:3000'` (insufficient)

3. **`apps/api/src/config.ts:73`** - CORS processing
   - Splits comma-separated origins: `.split(',').map((origin) => origin.trim())`
   - Enables multi-origin support

4. **`apps/api/src/index.ts:65-70`** - CORS middleware
   ```typescript
   app.use(
     cors({
       origin: config.corsOrigins,  // ← Uses processed array from config.ts
       credentials: true,
     })
   );
   ```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORS REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Browser @ http://localhost:3012/bills                          │
│     │                                                               │
│     ├─> Sends fetch('http://localhost:4000/api/v1/bills')         │
│     │   WITH Origin: http://localhost:3012 header                  │
│     │                                                               │
│  2. API Server @ http://localhost:4000                             │
│     │                                                               │
│     ├─> Receives request                                           │
│     │                                                               │
│     ├─> CORS middleware checks config.corsOrigins array            │
│     │   Current: ['http://localhost:3000']                         │
│     │   ❌ Origin 'http://localhost:3012' NOT in array             │
│     │   ❌ BLOCKS REQUEST                                           │
│     │                                                               │
│     │   After fix: ['http://localhost:3000',                       │
│     │               'http://localhost:3012',                        │
│     │               'http://localhost:3001']                        │
│     │   ✅ Origin 'http://localhost:3012' IS in array              │
│     │   ✅ ALLOWS REQUEST                                           │
│     │                                                               │
│     └─> Returns response with:                                     │
│         Access-Control-Allow-Origin: http://localhost:3012         │
│         Access-Control-Allow-Credentials: true                     │
│                                                                     │
│  3. Browser receives response                                      │
│     │                                                               │
│     ├─> Checks Access-Control-Allow-Origin header                  │
│     │   ✅ Matches Origin: http://localhost:3012                   │
│     │   ✅ Allows JavaScript to read response                      │
│     │                                                               │
│     └─> Data loads successfully!                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps After Fix

Once CORS is fixed, continue with remaining BLOCKER-001 remediation tasks:

1. ✅ **Task 1: CORS Configuration** (THIS DOCUMENT)
2. ⏭️ **Task 2: Configure NEXT_PUBLIC_API_URL** (verify in .env)
3. ⏭️ **Task 3: Implement Error Boundary components** (frontend error handling)
4. ⏭️ **Task 4: Add request timeout handling** (API client config)
5. ⏭️ **Task 5: Verify data loading across all pages** (end-to-end testing)

---

## Security Considerations

### Why These Ports?

- **localhost only**: All origins are localhost (development environment)
- **No wildcards**: Explicit port list prevents overly permissive CORS
- **credentials: true**: Allows cookies/auth tokens to be sent with requests

### Production Configuration

In production (`.env.production`), CORS_ORIGINS should be:
```bash
CORS_ORIGINS=https://ltip.yourdomain.com
```

**NEVER** use wildcards or multiple domains in production unless absolutely necessary.

---

## References

- **Previous Session**: Task 8 verified frontend on port 3012
- **Project Assessment**: BLOCKER-001 documented in PROJECT_ASSESSMENT_REPORT.md
- **CORS Spec**: [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- **Express CORS Package**: [npm cors](https://www.npmjs.com/package/cors)

---

**Last Updated**: 2026-01-30
**Status**: Ready for Implementation
**Estimated Time**: 5 minutes + service restart (2-3 minutes)
**Risk Level**: LOW (configuration-only change, easily reversible)
